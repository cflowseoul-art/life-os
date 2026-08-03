/**
 * Dugong Ledger — read-only adapter.
 *
 * The ledger is the source of truth for money. Life OS keeps **no separate
 * Finance database**: every figure Finance states is read from 거래내역 at the
 * moment it is stated, so the two can never disagree.
 *
 * This module is read-only by construction. It exposes no write, no append, no
 * update — a future receipt write will be a separate, explicitly-gated module,
 * and it will not exist until receipts can match a real transaction first.
 *
 * Access is a Google service account, read-only:
 *   GOOGLE_APPLICATION_CREDENTIALS   service-account key file
 *   DUGONG_LEDGER_SPREADSHEET_ID     the ledger
 *   DUGONG_LEDGER_SHEET_NAME         the tab (거래내역)
 *
 * The OAuth scope requested is `spreadsheets.readonly`. Even if this module
 * were asked to write, the token it holds could not.
 *
 * DUGONG_LEDGER_CSV (a local export path) is honoured first, so the same logic
 * can be exercised offline without touching the real ledger.
 */

import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export type LedgerTransaction = {
  /** ISO date, as recorded in 거래내역. */
  date: string;
  /** 내용 / 가맹점 — what the line says it was. */
  description: string;
  /** 분류 / 카테고리 — blank when the ledger left it blank. */
  category: string;
  /** Won. Negative is money out, as the ledger records it. */
  amount: number;
  /** 결제수단, when the ledger carries one. */
  method: string;
  /** Row number in 거래내역, so any figure can be traced back by hand. */
  row: number;
};

export type LedgerRead =
  | { ok: true; transactions: LedgerTransaction[]; source: string }
  | { ok: false; reason: string };

/** Column aliases. The ledger names its columns; we adapt, it does not. */
const COLUMNS: Record<keyof Omit<LedgerTransaction, "row">, string[]> = {
  // Dugong Ledger's own column names come first; the rest are tolerated
  // spellings so a renamed column does not silently zero out the figures.
  date: ["이용일자", "날짜", "일자", "거래일", "거래일자", "date"],
  description: ["가맹점명/받는 사람", "가맹점명", "내용", "가맹점", "적요", "거래처", "메모", "description", "merchant"],
  category: ["분류", "카테고리", "항목", "category"],
  amount: ["이용금액", "금액", "출금", "지출", "amount", "price"],
  method: ["이용카드/계좌", "결제수단", "수단", "카드", "계정", "method", "account"],
};

/** Minimal RFC4180 splitter: quoted fields, embedded commas, doubled quotes. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { cell += '"'; i += 1; continue; }
      if (char === '"') { quoted = false; continue; }
      cell += char;
      continue;
    }

    if (char === '"') { quoted = true; continue; }
    if (char === ",") { cells.push(cell); cell = ""; continue; }
    cell += char;
  }

  cells.push(cell);
  return cells.map((c) => c.trim());
}

function indexOfColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.some((a) => h.toLowerCase() === a.toLowerCase()));
}

function normaliseDate(raw: string): string | null {
  const match = /(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/.exec(raw);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

/** Parses 거래내역 as CSV. Unreadable rows are skipped, never guessed at. */
export function parseLedgerCsv(csv: string): LedgerTransaction[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  return parseLedgerRows(lines.map(splitRow));
}

/** Same mapping, from rows the Sheets API returned. */
export function parseLedgerRows(rows: string[][]): LedgerTransaction[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const at = {
    date: indexOfColumn(headers, COLUMNS.date),
    description: indexOfColumn(headers, COLUMNS.description),
    category: indexOfColumn(headers, COLUMNS.category),
    amount: indexOfColumn(headers, COLUMNS.amount),
    method: indexOfColumn(headers, COLUMNS.method),
  };

  if (at.date === -1 || at.amount === -1) return [];

  const transactions: LedgerTransaction[] = [];

  rows.slice(1).forEach((cells, index) => {
    const date = normaliseDate(cells[at.date] ?? "");
    const amount = Number((cells[at.amount] ?? "").replace(/[^\d.-]/g, ""));

    if (date === null || Number.isNaN(amount) || amount === 0) return;

    transactions.push({
      date,
      description: at.description === -1 ? "" : cells[at.description] ?? "",
      category: at.category === -1 ? "" : cells[at.category] ?? "",
      amount,
      method: at.method === -1 ? "" : cells[at.method] ?? "",
      row: index + 2,
    });
  });

  return transactions;
}

/**
 * The ledger's own classification rules (분류규칙).
 *
 * 통계포함 = N marks movements that are not spending — card settlements,
 * transfers to savings or investments, carried-over balances. Finance uses the
 * ledger's judgment here rather than inventing its own list of what counts.
 */
export type CategoryRule = { category: string; type: string; countsAsSpending: boolean };

export function parseCategoryRules(rows: string[][]): Map<string, CategoryRule> {
  const rules = new Map<string, CategoryRule>();
  if (rows.length < 2) return rules;

  const headers = rows[0].map((h) => h.trim());
  const at = {
    category: headers.indexOf("분류"),
    type: headers.indexOf("거래유형"),
    include: headers.indexOf("통계포함"),
  };

  if (at.category === -1) return rules;

  for (const cells of rows.slice(1)) {
    const category = (cells[at.category] ?? "").trim();
    if (category === "" || rules.has(category)) continue;

    rules.set(category, {
      category,
      type: at.type === -1 ? "" : (cells[at.type] ?? "").trim(),
      countsAsSpending: at.include === -1 ? true : (cells[at.include] ?? "").trim().toUpperCase() !== "N",
    });
  }

  return rules;
}

/** Read-only. The one scope this module ever asks for. */
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Exchanges the service-account key for a read-only access token.
 *
 * Signed locally with node:crypto — no SDK, no dependency, and the key never
 * leaves this process.
 */
async function accessToken(account: ServiceAccount): Promise<string> {
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  const claim = {
    iss: account.client_email,
    scope: SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claim))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = (await response.json()) as { access_token?: string; error_description?: string; error?: string };

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? `토큰 발급 실패 (${String(response.status)})`);
  }

  return body.access_token;
}

async function fetchRows(range: string): Promise<string[][]> {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const spreadsheetId = process.env.DUGONG_LEDGER_SPREADSHEET_ID;

  if (!keyFile) throw new Error("GOOGLE_APPLICATION_CREDENTIALS가 설정되지 않았습니다.");
  if (!existsSync(keyFile)) throw new Error(`인증 파일을 찾지 못했습니다: ${keyFile}`);
  if (!spreadsheetId) throw new Error("DUGONG_LEDGER_SPREADSHEET_ID가 설정되지 않았습니다.");

  const account = JSON.parse(readFileSync(keyFile, "utf8")) as ServiceAccount;
  const token = await accessToken(account);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
    { headers: { authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(detail.error?.message ?? `시트를 읽지 못했습니다 (${String(response.status)})`);
  }

  return ((await response.json()) as { values?: string[][] }).values ?? [];
}

/** The ledger's classification rules. Empty map when the tab is absent. */
export async function readCategoryRules(): Promise<Map<string, CategoryRule>> {
  try {
    return parseCategoryRules(await fetchRows(process.env.DUGONG_LEDGER_RULES_SHEET ?? "분류규칙"));
  } catch {
    return new Map();
  }
}

/** Reads the tab as rows. Never writes: no write method exists here. */
async function readSheet(): Promise<LedgerTransaction[]> {
  const sheetName = process.env.DUGONG_LEDGER_SHEET_NAME ?? "거래내역";

  return parseLedgerRows(await fetchRows(sheetName));
}

/**
 * Reads 거래내역.
 *
 * Returns a reason rather than an empty list when it cannot read: Finance must
 * never mistake "no access" for "no spending" (Art. 9).
 */
export async function readLedger(): Promise<LedgerRead> {
  const local = process.env.DUGONG_LEDGER_CSV;

  if (local) {
    if (!existsSync(local)) return { ok: false, reason: `가계부 파일을 찾지 못했습니다: ${local}` };
    return { ok: true, transactions: parseLedgerCsv(readFileSync(local, "utf8")), source: local };
  }

  try {
    const transactions = await readSheet();
    return {
      ok: true,
      transactions,
      source: `${process.env.DUGONG_LEDGER_SHEET_NAME ?? "거래내역"} (Dugong Ledger)`,
    };
  } catch (error) {
    // No access is never reported as "no spending" (Art. 9).
    return {
      ok: false,
      reason: `가계부를 읽지 못했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    };
  }
}

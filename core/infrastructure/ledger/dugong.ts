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
 * Two sources, same shape:
 *   DUGONG_LEDGER_CSV  a local export (path)      — no network, works offline
 *   DUGONG_SHEET_ID    the sheet itself (gviz CSV) — requires the sheet to be
 *                      readable by link; a private sheet returns 401 and this
 *                      module reports that rather than returning nothing.
 */

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
  date: ["날짜", "일자", "거래일", "거래일자", "date"],
  description: ["내용", "가맹점", "적요", "거래처", "메모", "description", "merchant"],
  category: ["분류", "카테고리", "항목", "category"],
  amount: ["금액", "출금", "지출", "amount", "price"],
  method: ["결제수단", "수단", "카드", "계정", "method", "account"],
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

  const headers = splitRow(lines[0]);
  const at = {
    date: indexOfColumn(headers, COLUMNS.date),
    description: indexOfColumn(headers, COLUMNS.description),
    category: indexOfColumn(headers, COLUMNS.category),
    amount: indexOfColumn(headers, COLUMNS.amount),
    method: indexOfColumn(headers, COLUMNS.method),
  };

  if (at.date === -1 || at.amount === -1) return [];

  const transactions: LedgerTransaction[] = [];

  lines.slice(1).forEach((line, index) => {
    const cells = splitRow(line);
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

const SHEET_ID = process.env.DUGONG_SHEET_ID ?? "11wMsNGXzHnDq7FbK51B3dyGZUe_NnNLmZwZid0EvtM0";
const SHEET_NAME = process.env.DUGONG_SHEET_TAB ?? "거래내역";

function sheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
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
    const response = await fetch(sheetUrl(), { redirect: "follow" });

    if (!response.ok) {
      return {
        ok: false,
        reason:
          response.status === 401 || response.status === 403
            ? "가계부 시트를 열 권한이 없습니다. 링크가 있는 사람은 보기로 공유해 주시거나, 내보낸 CSV 경로를 알려주십시오."
            : `가계부 시트를 읽지 못했습니다 (${String(response.status)}).`,
      };
    }

    const text = await response.text();

    if (text.trimStart().startsWith("<")) {
      return { ok: false, reason: "가계부 시트가 CSV 대신 로그인 화면을 돌려주었습니다. 보기 권한을 열어 주십시오." };
    }

    return { ok: true, transactions: parseLedgerCsv(text), source: "거래내역" };
  } catch (error) {
    return { ok: false, reason: `가계부에 연결하지 못했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}` };
  }
}

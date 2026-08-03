/**
 * Home capability — receipts.
 *
 * Art. 15: data, domain logic, and copy. No interaction pattern, no state, no
 * user-facing noun. Everything here is a *proposal*; it never writes.
 *
 * Art. 9: every item and every number comes from a line of the receipt. Nothing
 * is inferred, rounded, or completed from knowledge of what people usually buy.
 * A line that cannot be read is skipped, never guessed.
 */

import type { Artifact, Observation } from "../../events/types.ts";

export const CAPABILITY_ID = "home";

/**
 * The OCR seam.
 *
 * Today a receipt arrives as text the representative pasted. A real OCR adapter
 * implements this same signature and nothing else changes — the capability
 * never learns which one it is talking to (Art. 7: infrastructure is replaceable).
 */
export type Ocr = (input: string) => string;

export const passthroughOcr: Ocr = (input) => input;

export type ReceiptItem = {
  name: string;
  quantity: number;
  /** Won. Read from the line, never computed from a unit price. */
  amount: number;
  /** Which line of the receipt this came from. */
  line: number;
};

const AMOUNT = /(-?[\d,]+)\s*원?$/;
const QUANTITY = /(?:^|\s)(?:x|X|\*)?\s*(\d+)\s*(?:개|팩|병|봉|입)?\s+(?=[\d,]+\s*원?$)/;

/**
 * Reads a receipt into items.
 *
 * A line counts only when it ends in an amount. Everything else — store name,
 * date, card footer, totals — is left alone rather than half-understood.
 */
export function readReceipt(text: string): ReceiptItem[] {
  const items: ReceiptItem[] = [];

  text.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;

    // Totals are not purchases. They are the sum of purchases.
    if (/^(합계|총액|결제|카드|받은돈|거스름|부가세)/.test(line)) return;

    const amountMatch = AMOUNT.exec(line);
    if (!amountMatch) return;

    const amount = Number(amountMatch[1].replace(/,/g, ""));
    if (Number.isNaN(amount)) return;

    const head = line.slice(0, amountMatch.index).trim();
    const quantityMatch = QUANTITY.exec(`${head} 0`);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const name = head.replace(/(?:x|X|\*)?\s*\d+\s*(?:개|팩|병|봉|입)?$/, "").trim();

    if (name === "") return;

    items.push({ name, quantity, amount, line: index + 1 });
  });

  return items;
}

/** One observation per item, each pointing at the line it came from (Art. 10). */
export function observe(text: string, acquiredAt: string): Observation[] {
  return readReceipt(text).map((item, index) => ({
    id: `item-${String(index + 1)}`,
    statement: `${item.name} ${String(item.quantity)}개 · ${item.amount.toLocaleString("ko-KR")}원`,
    source: `receipt:${String(item.line)}`,
    acquiredAt,
    confidence: 1,
  }));
}

/**
 * What Home produces: the inventory change, and the expense that Finance owns.
 *
 * Home never states an opinion about the money; it hands the figure over. The
 * total is the sum of lines actually read, never a total printed on the
 * receipt that we did not verify item by item.
 */
export function proposeArtifact(store: string, items: ReceiptItem[]): Artifact {
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: `receipt-${store}`.replace(/\s+/g, "-"),
    title: `${store} 영수증 정리`,
    sections: [
      ...items.map((item, index) => ({
        heading: `${item.name} ${String(item.quantity)}개`,
        body: `영수증 ${String(item.line)}번째 줄 · ${item.amount.toLocaleString("ko-KR")}원`,
        derivedFrom: [`item-${String(index + 1)}`],
      })),
      {
        heading: `지출 합계 ${total.toLocaleString("ko-KR")}원`,
        body: "재무팀에 넘겼습니다.",
        derivedFrom: items.map((_, index) => `item-${String(index + 1)}`),
      },
    ],
  };
}

/** Art. 9 enforcement input: the only numbers this capability may state. */
export function factualNumbers(items: ReceiptItem[]): Set<number> {
  const allowed = new Set<number>([items.length, items.reduce((s, i) => s + i.amount, 0)]);

  items.forEach((item, index) => {
    allowed.add(item.amount);
    allowed.add(item.quantity);
    allowed.add(item.line);
    allowed.add(index + 1);
  });

  return allowed;
}

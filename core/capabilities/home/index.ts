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
  /** The product as printed, size included. `서울우유 1L`, never `서울우유`. */
  name: string;
  quantity: number;
  /** The counting unit as printed: 개, 봉, 팩, 병, 캔, 줄… `null` when bare. */
  unit: string | null;
  /** Won. Read from the line, never computed from a unit price. */
  amount: number;
  /** Which line of the receipt this came from. */
  line: number;
};

export type Receipt = {
  items: ReceiptItem[];
  /** Discounts as printed, kept separate from purchases. */
  discounts: { label: string; amount: number; line: number }[];
  /** Sum of items less discounts. Computed from lines actually read. */
  total: number;
};

/** Lines that are not purchases. */
const NOT_AN_ITEM =
  /^(합계|총액|소계|결제|카드|현금|받은|거스름|부가세|과세|면세|승인|포인트|적립|잔액|매출|주소|전화|사업자)/;

/**
 * The same, in English. `\b` is meaningless after a Korean character in
 * JavaScript, so the two alphabets need two expressions rather than one.
 */
const NOT_AN_ITEM_EN =
  /^(total|subtotal|sub-total|sum|cash|change|payment|balance|vat|tax|amount due|approval|card|due)\b/i;

/** Discount lines. Real, but they take money off rather than adding an item. */
const DISCOUNT = /^(할인|행사할인|쿠폰|에누리|즉시할인|멤버십할인|카드할인)/;

/**
 * A quantity line in the two-line layout convenience stores print:
 *
 *     삼각김밥 참치마요
 *     1개 x 1,300      1,300
 *
 * The product is on the line above; this line carries only how many and how
 * much. Read alone it would enter inventory as an item called "1개 x 1,300".
 */
const QUANTITY_LINE = /^(\d+)\s*(개|봉|팩|병|캔|입|박스|세트|줄|장|롤|포)?\s*[x×X*]\s*[\d,]*$/;

/** A line that is nothing but an amount — a wrapped line total. */
const BARE_AMOUNT = /^[\d,]+\s*원?$/;

/** A date or a time ends in digits and buys nothing. */
const DATE_OR_TIME = /^\d{2,4}[-./]\d{1,2}[-./]\d{1,2}|^\d{1,2}:\d{2}/;

const AMOUNT = /(-?[\d,]+)\s*원?$/;

/**
 * Counting units. A number carrying one of these is *how many* were bought.
 *
 * `구` is deliberately absent: 30구 is the size of an egg carton, not a count of
 * cartons. It stays in the product name, where it belongs.
 */
const COUNT_UNITS = ["개", "봉", "팩", "병", "캔", "입", "박스", "세트", "줄", "장", "롤", "포"];

/** Size units. Always part of the product's identity, never a quantity. */
const SIZE_UNITS = ["L", "l", "ml", "mL", "ML", "g", "G", "kg", "Kg", "KG", "cc", "구", "매"];

const COUNT_TAIL = new RegExp(`^(.*?)[\\s]*(?:x|X|\\*)?\\s*(\\d+)\\s*(${COUNT_UNITS.join("|")})$`);
const BARE_TAIL = /^(.*?)\s+(?:x|X|\*)\s*(\d+)$|^(.*?)\s+(\d+)$/;

function isSizeToken(token: string): boolean {
  return SIZE_UNITS.some((u) => new RegExp(`^\\d+(?:\\.\\d+)?${u}$`).test(token));
}

/**
 * Splits the text before the amount into a product and a quantity.
 *
 * The quantity is only ever the *last* token, and only when it counts things.
 * Everything before it — including sizes and pack counts — is the product's
 * identity, so `서울우유 1L` and `서울우유 900ml` never merge.
 */
function splitQuantity(head: string): { name: string; quantity: number; unit: string | null } {
  const counted = COUNT_TAIL.exec(head);

  if (counted && counted[1].trim() !== "") {
    return { name: counted[1].trim(), quantity: Number(counted[2]), unit: counted[3] };
  }

  const tokens = head.split(/\s+/);
  const last = tokens[tokens.length - 1] ?? "";

  // A bare trailing integer is a count — unless it is a size (500g) or the
  // whole product name (계란 30구 → 계란 30구, one carton).
  if (tokens.length > 1 && /^(?:x|X|\*)?\d+$/.test(last) && !isSizeToken(last)) {
    return {
      name: tokens.slice(0, -1).join(" "),
      quantity: Number(last.replace(/^[xX*]/, "")),
      unit: null,
    };
  }

  return { name: head, quantity: 1, unit: null };
}

/**
 * Reads a receipt.
 *
 * A line counts only when it ends in an amount. Store name, date, totals, card
 * footers and blank lines are left alone rather than half-understood, and a
 * line whose product name would be empty is skipped rather than guessed.
 *
 * Identical lines are kept as separate purchases: two of the same item rung up
 * twice is what the receipt says, and collapsing them would invent a fact.
 * Inventory merges them later by name, where merging is correct.
 */
export function readReceipt(text: string): Receipt {
  const items: ReceiptItem[] = [];
  const discounts: { label: string; amount: number; line: number }[] = [];
  const lines = text.split("\n").map((l) => l.trim());

  /** The most recent line that looked like a product name and was not used. */
  let pendingName: { name: string; line: number } | null = null;

  lines.forEach((line, index) => {
    if (
      line === ""
      || NOT_AN_ITEM.test(line)
      || NOT_AN_ITEM_EN.test(line)
      || DATE_OR_TIME.test(line)
    ) {
      pendingName = null;
      return;
    }

    const amountMatch = AMOUNT.exec(line);

    if (!amountMatch) {
      // No amount: this is a product name waiting for its quantity line.
      pendingName = { name: line, line: index + 1 };
      return;
    }

    const amount = Number(amountMatch[1].replace(/,/g, ""));
    if (Number.isNaN(amount)) {
      pendingName = null;
      return;
    }

    const head = line.slice(0, amountMatch.index).trim();

    // A discount line, or any negative amount, takes money off.
    if (DISCOUNT.test(line) || amount < 0) {
      discounts.push({ label: head === "" ? line : head, amount: Math.abs(amount), line: index + 1 });
      pendingName = null;
      return;
    }

    // Two-line layout: quantity and price under a product name.
    if (pendingName && (head === "" || QUANTITY_LINE.test(head) || BARE_AMOUNT.test(line))) {
      const counted = /^(\d+)\s*(개|봉|팩|병|캔|입|박스|세트|줄|장|롤|포)?/.exec(head);
      const quantity = counted ? Number(counted[1]) : 1;

      // The line total may wrap onto the next line: `2개 x 1,700` / `3,400`.
      const next = lines[index + 1] ?? "";
      const wrapped = BARE_AMOUNT.test(next) ? Number(next.replace(/[,원]/g, "")) : NaN;
      const total = Number.isNaN(wrapped) ? amount : wrapped;

      items.push({
        name: pendingName.name,
        quantity,
        unit: counted?.[2] ?? null,
        amount: total,
        line: pendingName.line,
      });

      pendingName = null;
      if (!Number.isNaN(wrapped)) lines[index + 1] = "";
      return;
    }

    if (head === "") {
      pendingName = null;
      return;
    }

    const { name, quantity, unit } = splitQuantity(head);
    if (name === "" || /^[\d,.\s]+$/.test(name)) {
      pendingName = null;
      return;
    }

    items.push({ name, quantity, unit, amount, line: index + 1 });
    pendingName = null;
  });

  const total =
    items.reduce((sum, item) => sum + item.amount, 0)
    - discounts.reduce((sum, d) => sum + d.amount, 0);

  return { items, discounts, total };
}

/** One observation per item, each pointing at the line it came from (Art. 10). */
export function observe(text: string, acquiredAt: string): Observation[] {
  const { items, discounts } = readReceipt(text);

  return [
    ...items.map((item, index) => ({
      id: `item-${String(index + 1)}`,
      // Stable shape: name · quantity · amount. Read back by inventory.
      statement: `${item.name} · ${String(item.quantity)}${item.unit ?? "개"} · ${item.amount.toLocaleString("ko-KR")}원`,
      source: `receipt:${String(item.line)}`,
      acquiredAt,
      confidence: 1,
    })),
    ...discounts.map((d, index) => ({
      id: `discount-${String(index + 1)}`,
      statement: `${d.label} · 할인 · -${d.amount.toLocaleString("ko-KR")}원`,
      source: `receipt:${String(d.line)}`,
      acquiredAt,
      confidence: 1,
    })),
  ];
}

/**
 * What Home produces: the inventory change, and the expense that Finance owns.
 *
 * Home never states an opinion about the money; it hands the figure over. The
 * total is the sum of lines actually read, never a total printed on the
 * receipt that we did not verify item by item.
 */
export function proposeArtifact(store: string, receipt: Receipt): Artifact {
  const { items, discounts, total } = receipt;

  return {
    id: `receipt-${store}`.replace(/\s+/g, "-"),
    title: `${store} 영수증 정리`,
    sections: [
      ...items.map((item, index) => ({
        heading: `${item.name} ${String(item.quantity)}${item.unit ?? "개"}`,
        body: `영수증 ${String(item.line)}번째 줄 · ${item.amount.toLocaleString("ko-KR")}원`,
        derivedFrom: [`item-${String(index + 1)}`],
      })),
      ...discounts.map((d, index) => ({
        heading: `${d.label} -${d.amount.toLocaleString("ko-KR")}원`,
        body: `영수증 ${String(d.line)}번째 줄`,
        derivedFrom: [`discount-${String(index + 1)}`],
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
export function factualNumbers(receipt: Receipt): Set<number> {
  const { items, discounts, total } = receipt;
  const allowed = new Set<number>([items.length, total]);

  discounts.forEach((d) => { allowed.add(d.amount); allowed.add(d.line); });

  items.forEach((item, index) => {
    allowed.add(item.amount);
    allowed.add(item.quantity);
    allowed.add(item.line);
    allowed.add(index + 1);
  });

  return allowed;
}

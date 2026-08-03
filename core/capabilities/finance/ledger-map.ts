/**
 * Finance's understanding of the Dugong Ledger.
 *
 * The spreadsheet is Finance's operating manual, not merely a data source. This
 * module is what Finance knows about it: what each sheet is for, which sheets
 * hold truth, which are computed, and which must never be touched.
 *
 * Nothing here executes anything. It is a map, kept in code so it can be typed,
 * referenced, and corrected — and so that a future write path has to consult it
 * before it can exist.
 *
 * Read from the live spreadsheet on 2026-08-03.
 */

export type SheetRole =
  /** Where facts enter. Written by collection, not by Finance. */
  | "source"
  /** Computed from other sheets by spreadsheet formulas. Never written. */
  | "derived"
  /** Rules and working state the household maintains by hand. */
  | "operational"
  /** Structure, not data. */
  | "marker";

export type SheetKnowledge = {
  name: string;
  role: SheetRole;
  /** Why it exists, in one line. */
  purpose: string;
  /** What it reads from. Empty for source sheets. */
  readsFrom: string[];
  /** Whether Life OS may ever write here, and why not when false. */
  writable: false;
  neverWriteBecause: string;
  notes?: string;
};

/**
 * Every sheet in the ledger.
 *
 * `writable` is `false` on all of them today, and the type says `false` rather
 * than `boolean` — a write path cannot be added by flipping a flag; it has to
 * change this type deliberately.
 */
export const LEDGER_SHEETS: SheetKnowledge[] = [
  {
    name: "DB",
    role: "source",
    purpose: "카드사에서 받은 일시불 결제예정 원본. 수집된 그대로 쌓이는 자리.",
    readsFrom: [],
    writable: false,
    neverWriteBecause: "수집 원본이라, 여기에 손대면 원본과 대조할 기준이 사라집니다.",
    notes: "숨김 시트. 헤더가 2행에서 시작하고 1행은 제목 한 칸입니다.",
  },
  {
    name: "거래내역",
    role: "source",
    purpose: "가계부의 사실. 모든 거래 한 줄씩, 분류·상태·기준월까지 확정된 상태로.",
    readsFrom: ["DB", "분류규칙"],
    writable: false,
    neverWriteBecause:
      "돈에 대한 사실의 유일한 출처입니다. Life OS가 여기에 쓰면 두 개의 진실이 생깁니다.",
    notes: "A~R 18열. 파생 열(O 거래유형, P 통계포함, R 기준월)이 이미 계산돼 들어 있습니다.",
  },
  {
    name: "여기부터 수정불가 시트 >>",
    role: "marker",
    purpose: "이 오른쪽부터는 사람이 고치는 시트가 아니라는 표시.",
    readsFrom: [],
    writable: false,
    neverWriteBecause: "구조 표시일 뿐 데이터가 없습니다.",
    notes: "가계부 주인이 직접 그어 둔 경계선. 이 경계는 Finance도 지킵니다.",
  },
  {
    name: "분류규칙",
    role: "operational",
    purpose: "키워드 → 분류·거래유형·통계포함을 정하는 규칙표. 가계부의 판단 기준.",
    readsFrom: [],
    writable: false,
    neverWriteBecause:
      "무엇을 지출로 볼지 정하는 규칙은 대표님의 기준입니다. 회사가 고칠 자리가 아닙니다.",
    notes: "우선순위·키워드·분류·거래유형·통계포함·적용수집원·등록방식 7열.",
  },
  {
    name: "LOOKER_KPI",
    role: "derived",
    purpose: "월별 총수입·총지출·고정비·변동비·자산축적률 등 지표.",
    readsFrom: ["거래내역"],
    writable: false,
    neverWriteBecause: "ARRAYFORMULA 한 칸이 시트 전체를 만듭니다. 쓰면 수식이 깨집니다.",
  },
  {
    name: "LOOKER_CATEGORY",
    role: "derived",
    purpose: "월·분류별 금액과 전월 대비 증감.",
    readsFrom: ["거래내역"],
    writable: false,
    neverWriteBecause: "수식 산출물입니다.",
  },
  {
    name: "LOOKER_STORE",
    role: "derived",
    purpose: "월·가맹점별 금액과 건수.",
    readsFrom: ["거래내역"],
    writable: false,
    neverWriteBecause: "수식 산출물입니다.",
  },
  {
    name: "LOOKER_SANKEY",
    role: "derived",
    purpose: "수입에서 지출·이동까지 돈의 흐름을 단계별로 펼친 표.",
    readsFrom: ["거래내역"],
    writable: false,
    neverWriteBecause: "수식 산출물입니다.",
  },
  {
    name: "PENDING_ASSET",
    role: "operational",
    purpose: "아직 들어오지 않은 자산 — 카드 이벤트 포인트, 예정 수령분 등을 손으로 관리.",
    readsFrom: [],
    writable: false,
    neverWriteBecause:
      "예정 자산은 대표님이 직접 관리하는 목록입니다. 회사는 읽기만 합니다.",
    notes: "ID·유형·제목·발생일·예정수령일·예상가치·실제수령가치·상태·자산형태·지급처·사용기한·관련거래ID.",
  },
];

/** 거래내역's columns, as the ledger names them. */
export const TRANSACTION_COLUMNS = {
  A: "이용일자",
  B: "이용카드/계좌",
  C: "가맹점명/받는 사람",
  D: "이용금액",
  E: "청구원금",
  F: "수수료·이자",
  G: "연체이자",
  H: "회차",
  I: "잔여원금",
  J: "분류",
  K: "상태",
  L: "알림수신시각",
  M: "거래고유키",
  N: "알림원문",
  O: "거래유형",
  P: "통계포함",
  Q: "수집원",
  R: "기준월",
} as const;

/**
 * The columns the ledger has already decided, so Finance does not decide again.
 *
 * 거래유형 (O) and 통계포함 (P) are computed per row from 분류규칙 when the row
 * is recorded. Re-deriving them from the category would be a second model of
 * the same question, and the two would eventually disagree.
 */
export const AUTHORITATIVE_COLUMNS = ["거래유형", "통계포함", "기준월", "상태"] as const;

/** The natural key for matching a receipt to a transaction. */
export const TRANSACTION_KEY_COLUMN = "거래고유키";

export function sheet(name: string): SheetKnowledge | null {
  return LEDGER_SHEETS.find((s) => s.name === name) ?? null;
}

/**
 * May Life OS write here?
 *
 * No. Every sheet, today. The function exists so a future write path must ask,
 * and so the answer is recorded in one place rather than assumed at each call.
 */
export function mayWrite(_sheetName: string): false {
  return false;
}

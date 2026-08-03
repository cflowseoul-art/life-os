/**
 * Asset's snapshot model.
 *
 * Asset answers one question: **무엇을 지금 갖고 있고 무엇을 지고 있는가.**
 * A balance is a state, and a state is only known when a source records it.
 *
 * Two rules hold this module together:
 *   - a snapshot is read from a source that states it, never summed from events
 *   - a snapshot is a balance and nothing more: not available cash, not free
 *     cash, not safe-to-spend, not investable. Purpose requires a policy the
 *     representative set, and no such policy exists.
 */

export type AssetType =
  | "cash"
  | "deposit"
  | "investment"
  | "pension"
  | "receivable"
  | "liability"
  | "other";

export type AssetSnapshot = {
  /** When the state was true, as the source records it. */
  asOf: string;
  /** The account or asset, named by the source. */
  name: string;
  /**
   * Classified by the source only. Where the source says nothing, "other" —
   * never guessed from a merchant or account name.
   */
  type: AssetType;
  amount: number;
  /** Which source recorded it (잔액기록, PENDING_ASSET, ...). */
  source: string;
  /** Row or id in that source, so any figure can be checked by hand. */
  evidence: string;
  /** Present only when the source links it to a transaction. */
  relatedTransactionKey?: string;
  note?: string;
};

/** Not-yet-received assets, as PENDING_ASSET records them. */
export type PendingAsset = {
  id: string;
  title: string;
  kind: string;
  expectedValue: number | null;
  receivedValue: number | null;
  status: string;
  /** 자산형태 as written by the source. */
  form: string;
  expectedOn: string;
  source: string;
  evidence: string;
};

/**
 * The source's own words for what an asset is.
 *
 * Only exact matches map. Anything else is "other", because a wrong type is
 * worse than an unspecific one.
 */
const TYPE_BY_SOURCE_WORD: Record<string, AssetType> = {
  "\ud604\uae08": "cash",
  "\uc785\ucd9c\uae08": "cash",
  "\ud1b5\uc7a5": "cash",
  "\uc608\uae08": "deposit",
  "\uc801\uae08": "deposit",
  "\ud22c\uc790": "investment",
  "\uc99d\uad8c": "investment",
  "\uc5f0\uae08": "pension",
  "\ud3ec\uc778\ud2b8": "receivable",
  "\ub300\ucd9c": "liability",
  "\ubd80\ucc44": "liability",
};

export function typeFromSource(word: string | undefined): AssetType {
  if (!word) return "other";
  return TYPE_BY_SOURCE_WORD[word.trim()] ?? "other";
}

/** Liabilities stay liabilities. Sign flipping is a reporting decision, not this. */
export function isLiability(snapshot: AssetSnapshot): boolean {
  return snapshot.type === "liability";
}

/**
 * Two snapshots are the same record when the source, account and date agree.
 * Used to notice duplicates, never to merge them silently.
 */
export function identity(snapshot: AssetSnapshot): string {
  return `${snapshot.source}:${snapshot.name}:${snapshot.asOf}`;
}

/**
 * The Job Fit Analyst.
 *
 * Reads a posting, compares it against what Career knows about the
 * representative, and returns a judgement. It evaluates and stops: it writes no
 * document, proposes no positioning, asks no strategy question, and never
 * modifies knowledge.
 *
 * **How the comparison works, and why it is not word counting.**
 *
 * The old analyst tokenised the posting, tokenised whatever profile text
 * happened to be pasted alongside it, and counted the words they shared. Two
 * shared tokens was a "strong match". That produced a percentage from an
 * accident of vocabulary, and a posting written in prose scored zero.
 *
 * This one never compares two texts. It starts from Career's **typed
 * knowledge** — each skill the representative holds, each claim they may not
 * make, each recorded weakness — and asks one question per entity: does this
 * posting ask for it? The match is then decided by the *structure* of the
 * knowledge, not by the posting:
 *
 *   - a skill with two or more evidenced experiences is a strong match
 *   - a skill with one is a partial match
 *   - something the record says may not be claimed is a gap, always
 *
 * So the posting can only ever select from what Career knows. It cannot
 * contribute evidence, and it cannot raise a score by repeating a word.
 *
 * Everything here is deterministic: the same posting and the same knowledge
 * produce the same report, because iteration order comes from the knowledge —
 * never from scanning the text.
 */

import type { CareerKnowledge } from "./knowledge/index.ts";

export type MatchKind = "strong" | "partial" | "gap";

export type RequirementMatch = {
  /** The knowledge entity the posting asked for. Never a line of the posting. */
  requirement: string;
  kind: MatchKind;
  /** Knowledge fact ids behind the verdict. Empty only when nothing supports it. */
  derivedFrom: string[];
  /** Why it landed here, in one line. */
  reason: string;
};

export type Risk = {
  statement: string;
  derivedFrom: string[];
};

/** Exactly three. The representative decides; the analyst recommends. */
export type Recommendation = "Apply" | "Hold" | "Skip";

export type FitReport = {
  company: string;
  position: string;
  /**
   * 0–100, or null when the posting asked for nothing Career recognises.
   *
   * Null rather than zero: "we found nothing we know" and "we know none of what
   * you need" are different findings, and a zero would state the second when
   * only the first is true.
   */
  percent: number | null;
  /** The arithmetic, stated so the figure can be checked by hand (Art. 9). */
  formula: string;
  strong: RequirementMatch[];
  partial: RequirementMatch[];
  gaps: RequirementMatch[];
  risks: Risk[];
  recommendation: Recommendation;
  reason: string;
};

/** A skill counts as strongly held once two experiences evidence it. */
const STRONG_EVIDENCE = 2;

const APPLY_AT = 70;
const HOLD_AT = 40;

/**
 * Compares an entity name against the posting.
 *
 * Case and separators are ignored so `A/B Test` matches `A/B test` and `AB
 * Test`. This is recognition of one named entity, not a comparison of two
 * documents — the posting is only ever asked yes-or-no about a term Career
 * already holds.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[\s/\-_.'’()]/g, "");
}

function asks(posting: string, term: string): boolean {
  const needle = normalise(term);
  return needle.length >= 2 && normalise(posting).includes(needle);
}

/**
 * The nameable subject of a prohibition.
 *
 * `Hex 실무 경험` is about Hex; `Data Engineer로서 파이프라인 전체 구축` is about
 * Data Engineer. The leading run of non-Hangul text is the thing a posting would
 * name. A wholly Korean prohibition is matched as written.
 */
function subjectOf(statement: string): string {
  const leading = /^[^가-힣]+/.exec(statement)?.[0].trim() ?? "";
  return leading.length >= 2 ? leading : statement;
}

/** Months covered by a `2025.03–2026.02` period. Null when unparseable. */
export function monthsOf(period: string): number | null {
  const found = /(\d{4})\.(\d{1,2})\s*[–\-~]\s*(\d{4})\.(\d{1,2})/.exec(period);
  if (!found) return null;

  const [, y1, m1, y2, m2] = found.map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) + 1;
  return months > 0 ? months : null;
}

/** Years of experience a posting asks for, when it says so. */
export function yearsRequired(posting: string): number | null {
  const found = /(\d+)\s*년\s*(?:이상|~|-|–)?/.exec(posting);
  return found ? Number(found[1]) : null;
}

/**
 * Reads a posting against Career Knowledge.
 *
 * Pure. Takes the knowledge it is given and returns a judgement; it holds no
 * state, writes nothing, and cannot reach a store of its own.
 */
export function analyseFit(
  input: { company: string; position: string; posting: string },
  knowledge: CareerKnowledge,
): FitReport {
  const { company, position, posting } = input;

  const strong: RequirementMatch[] = [];
  const partial: RequirementMatch[] = [];
  const gaps: RequirementMatch[] = [];
  const risks: Risk[] = [];

  // Iteration is over knowledge, in its recorded order, so the report is stable
  // whatever order the posting happens to mention things in.
  for (const skill of knowledge.factsOfType("skill")) {
    if (!asks(posting, skill.value.name)) continue;

    const evidence = skill.value.evidence;
    const match: RequirementMatch = {
      requirement: skill.value.name,
      kind: evidence.length >= STRONG_EVIDENCE ? "strong" : "partial",
      derivedFrom: [skill.id, ...evidence],
      reason:
        evidence.length >= STRONG_EVIDENCE
          ? `${String(evidence.length)}개 경험에서 확인됩니다 · ${skill.value.safeWording}`
          : `경험 1건에서 확인됩니다 · ${skill.value.safeWording}`,
    };

    (match.kind === "strong" ? strong : partial).push(match);
  }

  // A claim the record forbids is a gap even if a posting insists on it, and it
  // is the one finding that can hold back an otherwise strong application.
  let forbidden = false;

  for (const prohibition of knowledge.factsOfType("prohibited_claim")) {
    const subject = subjectOf(prohibition.value.claim);
    if (!asks(posting, subject)) continue;

    forbidden = true;
    gaps.push({
      requirement: subject,
      kind: "gap",
      derivedFrom: [prohibition.id],
      reason: `기록상 주장할 수 없습니다 · ${prohibition.value.claim}`,
    });
    risks.push({
      statement: `${subject}를 요구하지만 기록으로 뒷받침되지 않습니다.`,
      derivedFrom: [prohibition.id],
    });
  }

  for (const weakness of knowledge.factsOfType("weakness")) {
    const subject = subjectOf(weakness.value.statement);
    if (!asks(posting, subject)) continue;
    if (gaps.some((g) => g.requirement === subject)) continue;

    gaps.push({
      requirement: subject,
      kind: "gap",
      derivedFrom: [weakness.id],
      reason: `기록된 약점입니다 · ${weakness.value.statement}`,
    });
  }

  // Experience length: a stated requirement against a recorded span.
  const wanted = yearsRequired(posting);
  const employment = knowledge.factsOfType("employment");
  const months = employment
    .map((e) => monthsOf(e.value.period))
    .filter((m): m is number => m !== null)
    .reduce((sum, m) => sum + m, 0);

  if (wanted !== null && months > 0 && wanted * 12 > months) {
    risks.push({
      statement:
        `${String(wanted)}년을 요구하지만 기록된 경력은 ${String(months)}개월입니다.`,
      derivedFrom: employment.map((e) => e.id),
    });
  }

  const total = strong.length + partial.length + gaps.length;
  const scored = strong.length + partial.length * 0.5;
  const percent = total === 0 ? null : Math.round((scored / total) * 100);

  const formula =
    total === 0
      ? "공고에서 저희가 아는 요건을 찾지 못했습니다."
      : `강한 일치 ${String(strong.length)}건 × 1 + 부분 일치 ${String(partial.length)}건 × 0.5 `
        + `÷ 확인한 요건 ${String(total)}건`;

  const { recommendation, reason } = decide(percent, forbidden);

  return { company, position, percent, formula, strong, partial, gaps, risks, recommendation, reason };
}

/**
 * The recommendation, from stated thresholds.
 *
 * A prohibited claim never becomes an Apply, however well the rest scores: the
 * application would rest on something the representative cannot say in an
 * interview.
 */
function decide(
  percent: number | null,
  forbidden: boolean,
): { recommendation: Recommendation; reason: string } {
  if (percent === null) {
    return {
      recommendation: "Hold",
      reason: "공고에서 저희가 아는 요건을 찾지 못해 판단을 미룹니다.",
    };
  }

  if (forbidden) {
    return percent >= HOLD_AT
      ? {
          recommendation: "Hold",
          reason: "대응되는 경험은 있으나, 기록으로 주장할 수 없는 요건이 포함돼 있습니다.",
        }
      : {
          recommendation: "Skip",
          reason: "주장할 수 없는 요건이 있고 대응되는 경험도 부족합니다.",
        };
  }

  if (percent >= APPLY_AT) {
    return { recommendation: "Apply", reason: "요건 대부분이 기록된 경험으로 뒷받침됩니다." };
  }

  if (percent >= HOLD_AT) {
    return {
      recommendation: "Hold",
      reason: "대응되는 경험이 절반 정도입니다. 빈 곳을 메울 수 있는지 보고 정하실 일입니다.",
    };
  }

  return { recommendation: "Skip", reason: "기록된 경험으로 대응되는 요건이 적습니다." };
}

/** What the representative reads. Conclusions only — never the posting back. */
export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  Apply: "지원",
  Hold: "보류",
  Skip: "지원하지 않음",
};

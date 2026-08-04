/**
 * Job fit.
 *
 * Compares what a posting asks for against what the representative's profile
 * actually records. Every number here is arithmetic over those two lists — the
 * report states the formula, so the figure can be checked by hand.
 *
 * Art. 9: a requirement with no matching fact is a gap, never a soft "partial".
 * Nothing is credited to the representative that their profile does not say.
 */

export type MatchKind = "strong" | "partial" | "gap";

export type RequirementMatch = {
  requirement: string;
  kind: MatchKind;
  /** The profile lines that matched, quoted. Empty for a gap. */
  evidence: string[];
  /** Words shared between the requirement and the profile. */
  shared: string[];
};

export type FitReport = {
  requirements: number;
  matches: RequirementMatch[];
  /** 0–100, rounded. strong counts 1, partial 0.5, gap 0. */
  percent: number;
  formula: string;
  recommendation: "지원" | "검토" | "보류";
  reason: string;
};

/** Words that carry no signal about capability. */
const NOISE = new Set([
  "합니다", "하는", "있는", "위한", "대한", "통해", "그리고", "또는", "등을", "등의",
  "업무", "경험", "능력", "우대", "자격", "요건", "담당", "관련", "다양한", "함께",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !NOISE.has(t));
}

/**
 * Matches one requirement against the profile.
 *
 * Two or more shared terms is a strong match, one is partial, none is a gap.
 * Crude, but stated — and it never credits what is not written down.
 */
function match(requirement: string, profile: string[]): RequirementMatch {
  const wanted = new Set(tokens(requirement));
  const hits: { line: string; shared: string[] }[] = [];

  for (const line of profile) {
    const shared = [...new Set(tokens(line))].filter((t) => wanted.has(t));
    if (shared.length > 0) hits.push({ line, shared });
  }

  const shared = [...new Set(hits.flatMap((h) => h.shared))];
  const kind: MatchKind = shared.length >= 2 ? "strong" : shared.length === 1 ? "partial" : "gap";

  return {
    requirement,
    kind,
    evidence: hits.slice(0, 2).map((h) => h.line),
    shared,
  };
}

/** The representative's profile, one fact per line. */
export function readProfile(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter((l) => l.length >= 4);
}

export function analyse(requirements: string[], profile: string[]): FitReport {
  const matches = requirements.map((r) => match(r, profile));
  const strong = matches.filter((m) => m.kind === "strong").length;
  const partial = matches.filter((m) => m.kind === "partial").length;
  const total = matches.length;

  const percent = total === 0 ? 0 : Math.round(((strong + partial * 0.5) / total) * 100);

  const recommendation = percent >= 70 ? "지원" : percent >= 40 ? "검토" : "보류";

  return {
    requirements: total,
    matches,
    percent,
    formula:
      `강한 일치 ${String(strong)}건 × 1 + 부분 일치 ${String(partial)}건 × 0.5 ÷ 요건 ${String(total)}건`,
    recommendation,
    reason:
      recommendation === "지원"
        ? "요건 대부분에 대응되는 경험이 프로필에 있습니다."
        : recommendation === "검토"
          ? "대응되는 경험이 절반 정도입니다. 빈 곳을 메울 수 있는지 보고 정하실 일입니다."
          : "프로필에서 대응되는 경험을 거의 찾지 못했습니다.",
  };
}

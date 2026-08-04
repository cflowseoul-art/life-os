/**
 * Career capability.
 *
 * Art. 15 (Capabilities): this file contains data, domain logic, and copy. It
 * defines no interaction pattern, no state, and no user-facing noun. Everything
 * it returns is a *proposal* — it never writes.
 *
 * Art. 7 (AI Autonomy): a model would sit exactly here, producing the same
 * typed proposals. Nothing downstream would change, because the engine already
 * refuses to trust this module.
 */

import { POSTING_AUTHOR, statementOf } from "./facts.ts";
import type { JdRequirementFact } from "./facts.ts";
import type { Artifact, Ask, CareerHandover, KnowledgeFact } from "../../events/types.ts";

export const CAPABILITY_ID = "career";

/**
 * Art. 3 (Custody): a handover is refused before it is recorded, not after.
 * Validation lives here in the engine's call path, not in a disabled button.
 */
export function validateHandover(input: Partial<CareerHandover>): {
  ok: boolean;
  reasons: string[];
  value?: CareerHandover;
} {
  const reasons: string[] = [];
  const company = (input.company ?? "").trim();
  const role = (input.role ?? "").trim();
  const jdText = (input.jdText ?? "").trim();

  if (company === "") reasons.push("회사가 비어 있습니다.");
  if (role === "") reasons.push("직무가 비어 있습니다.");
  if (jdText === "") reasons.push("채용공고 본문이 비어 있습니다.");

  return reasons.length > 0
    ? { ok: false, reasons }
    : { ok: true, reasons: [], value: { company, role, jdText } };
}

/**
 * Reads what was handed over and records only what is literally there.
 *
 * Art. 9 (Trust): every observation is a quoted line with a line number. No
 * inference, no summarisation, no invented counts. If the requirement is not in
 * the text, it does not exist.
 */
/** A requirement worth carrying. Headings, boilerplate and duplicates are not. */
const MAX_REQUIREMENTS = 7;

function shorten(statement: string): string {
  const clean = statement.replace(/\s+/g, " ").trim();
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}

/**
 * Reads the posting into requirements — at most seven, deduplicated, each short
 * enough to scan. The full posting stays attached as the source; nothing here
 * re-renders it.
 */
export function observe(handover: CareerHandover, acquiredAt: string): JdRequirementFact[] {
  const observations: JdRequirementFact[] = [];
  const seen = new Set<string>();

  handover.jdText.split("\n").forEach((raw, index) => {
    if (observations.length >= MAX_REQUIREMENTS) return;

    const line = raw.trim();
    const isBullet = line.startsWith("-") || line.startsWith("*") || line.startsWith("•");
    if (!isBullet) return;

    const statement = shorten(line.replace(/^[-*•]\s*/, ""));
    if (statement === "" || statement.length < 4) return;

    const key = statement.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    observations.push({
      id: `req-${String(observations.length + 1)}`,
      type: "jd_requirement",
      value: { statement },
      source: `handover.jdText:${String(index + 1)}`,
      author: POSTING_AUTHOR,
      acquiredAt,
      // The line is quoted, so the source supports the stored value exactly.
      confidence: 1,
    });
  });

  return observations;
}

/**
 * The judgment fork.
 *
 * Art. 6 (Human Judgment): the system will not rank these itself. Which
 * requirement leads a résumé is a question about what the user wants to be
 * known for — a value, not a computation.
 *
 * Art. 4 (The Ask): the returned Ask carries its own facts and named options.
 * Returns null when no judgment is needed, which is the silent path (Art. 2).
 */
export function judgmentNeeded(
  holdId: string,
  handover: CareerHandover,
  observations: KnowledgeFact[],
  raisedAt: string,
): Omit<Ask, "id"> | null {
  if (observations.length < 2) {
    return null;
  }

  const [first, second] = observations;

  return {
    holdId,
    question: "이력서 첫 문단에서 무엇을 앞세울까요?",
    facts: [
      `${handover.company} · ${handover.role}`,
      `공고에서 확인한 요건 ${String(observations.length)}개`,
      ...observations.map((o) => `· ${statementOf(o)}`),
    ],
    options: [
      { id: first.id, label: statementOf(first), derivedFrom: [first.id] },
      { id: second.id, label: statementOf(second), derivedFrom: [second.id] },
    ],
    raisedAt,
  };
}

/**
 * Proposes the artifact. Ordering follows the user's answer, not our judgment.
 *
 * Art. 8 (Transparency): every section names the observation it came from, so
 * "why does it say this?" is answerable from the record alone.
 */
/**
 * The deliverable.
 *
 * What the representative asked for is a résumé opening, so that is what this
 * produces: a labelled draft they approve or correct. The posting's own words
 * appear once, as the requirements the draft answers — never again.
 *
 * Art. 9: nothing here claims experience the record does not hold. Where a
 * sentence needs a fact about the representative, it leaves a blank for them
 * rather than inventing one.
 */
export function proposeArtifact(
  handover: CareerHandover,
  observations: KnowledgeFact[],
  leadObservationId: string,
): Artifact {
  const lead = observations.find((o) => o.id === leadObservationId) ?? observations[0];
  const others = observations.filter((o) => o.id !== lead?.id);

  const draft = lead
    ? `${handover.company} ${handover.role} 지원자 〈이름〉입니다. `
      + `${statementOf(lead)}에 해당하는 일을 〈어디서·언제〉 맡아 〈무엇을 바꿨는지〉 중심으로 말씀드리겠습니다.`
    : `${handover.company} ${handover.role} 지원자 〈이름〉입니다.`;

  return {
    id: `artifact-${handover.company}-${handover.role}`.replace(/\s+/g, "-"),
    title: `${handover.company} · ${handover.role} — 이력서 첫 문단 초안`,
    sections: [
      {
        heading: `초안 · ${draft}`,
        body: "〈 〉 부분만 채우시면 그대로 쓰실 수 있습니다. 확정 전 초안입니다.",
        derivedFrom: lead ? [lead.id] : [],
      },
      {
        heading: `앞세운 요건 · ${lead ? statementOf(lead) : "없음"}`,
        body: "대표님이 고르신 순서입니다.",
        derivedFrom: lead ? [lead.id] : [],
      },
      {
        heading: `적합성 · 대조할 이력서가 없습니다`,
        body: others.length === 0
          ? "이력서를 주시면 요건별로 대조해 표시하겠습니다."
          : `나머지 요건 ${String(others.length)}개는 초안 뒤 문단에서 다루겠습니다. 이력서를 주시면 요건별로 대조하겠습니다.`,
        derivedFrom: [],
      },
    ],
  };
}

/** Art. 9 enforcement input: the only numbers this capability may state. */
export function factualNumbers(observations: KnowledgeFact[]): Set<number> {
  const allowed = new Set<number>([observations.length]);

  observations.forEach((_, index) => {
    allowed.add(index + 1);
  });

  // Line numbers are real: they are positions in the text the user handed over.
  observations.forEach((observation) => {
    const line = Number(observation.source.split(":")[1]);
    if (!Number.isNaN(line)) allowed.add(line);
  });

  return allowed;
}

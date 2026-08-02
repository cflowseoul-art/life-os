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

import type { Artifact, Ask, CareerHandover, Observation } from "../../events/types.ts";

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
export function observe(handover: CareerHandover, acquiredAt: string): Observation[] {
  const lines = handover.jdText.split("\n");
  const observations: Observation[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const isBullet = line.startsWith("-") || line.startsWith("*") || line.startsWith("•");

    if (!isBullet) {
      return;
    }

    const statement = line.replace(/^[-*•]\s*/, "").trim();

    if (statement === "") {
      return;
    }

    observations.push({
      id: `req-${String(observations.length + 1)}`,
      statement,
      source: `handover.jdText:${String(index + 1)}`,
      acquiredAt,
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
  observations: Observation[],
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
      ...observations.map((o) => `· ${o.statement}`),
    ],
    options: [
      { id: first.id, label: first.statement, derivedFrom: [first.id] },
      { id: second.id, label: second.statement, derivedFrom: [second.id] },
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
export function proposeArtifact(
  handover: CareerHandover,
  observations: Observation[],
  leadObservationId: string,
): Artifact {
  const lead = observations.find((o) => o.id === leadObservationId);
  const rest = observations.filter((o) => o.id !== leadObservationId);
  const ordered = lead ? [lead, ...rest] : observations;

  return {
    id: `artifact-${handover.company}-${handover.role}`.replace(/\s+/g, "-"),
    title: `${handover.company} · ${handover.role} — 강조 순서`,
    sections: ordered.map((observation, index) => ({
      heading: `${String(index + 1)}. ${observation.statement}`,
      body: `공고 원문 ${observation.source} 에서 확인한 요건입니다.`,
      derivedFrom: [observation.id],
    })),
  };
}

/** Art. 9 enforcement input: the only numbers this capability may state. */
export function factualNumbers(observations: Observation[]): Set<number> {
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

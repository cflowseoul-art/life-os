/**
 * Career's runner.
 *
 * Career work runs through the custody engine, on the representative's own
 * stream. The engine validates and records; this file only hands work over.
 */

import { CustodyEngine } from "../../custody/engine.ts";
import { randomUUID } from "node:crypto";

import { project } from "../../custody/engine.ts";
import type {
  AcceptInput,
  AcceptResult,
  AnswerInput,
  CapabilityRunner,
  ReviseInput,
} from "../../company/runner.ts";

/** `회사 · 직무` is what the engine needs; the subject is where it is written. */
function splitSubject(subject: string): { company: string; role: string } {
  const parts = subject.split(/[·|,\-—]/).map((p) => p.trim()).filter((p) => p !== "");
  return { company: parts[0] ?? "", role: parts.slice(1).join(" ") };
}

export const runner: CapabilityRunner = {
  id: "career",

  accept({ log, subject, request, attachment }: AcceptInput): AcceptResult {
    const { company, role } = splitSubject(subject);
    const engine = new CustodyEngine(log);

    const result = engine.handOver({
      company,
      role,
      jdText: [attachment, request].join("\n").trim(),
    });

    return result.ok ? { ok: true } : { ok: false, reasons: result.reasons };
  },

  answer({ log, optionId }: AnswerInput): void {
    const result = new CustodyEngine(log).answer(optionId);
    if (!result.ok) throw new Error(result.reason ?? "정하신 것을 남기지 못했습니다.");
  },

  /**
   * The representative wrote instead of choosing.
   *
   * Their words are recorded as given — the proposal that prompted them stays
   * in the record beside it — and the question is put again with every
   * requirement on the table, so an option they missed is now selectable.
   */
  revise({ log, ask, feedback }: ReviseInput): void {
    log.append(
      { type: "RevisionRequested", holdId: ask.holdId, askId: ask.id, feedback },
      { kind: "user" },
      "career",
      "computer",
    );

    const hold = project(log.read()).get(ask.holdId);
    const observations = hold?.observations ?? [];

    log.append(
      {
        type: "AskRaised",
        holdId: ask.holdId,
        ask: {
          id: randomUUID(),
          holdId: ask.holdId,
          question: ask.question,
          facts: [
            `대표님 말씀: ${feedback}`,
            "말씀 주신 내용을 우선으로 두고 다시 여쭙습니다.",
            ...observations.map((o) => `· ${o.statement}`),
          ],
          options: observations.map((o) => ({
            id: o.id,
            label: o.statement,
            derivedFrom: [o.id],
          })),
          raisedAt: new Date().toISOString(),
        },
      },
      { kind: "capability", id: "career" },
      "career",
      "revision",
    );
  },
};

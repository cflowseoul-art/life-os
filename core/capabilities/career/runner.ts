/**
 * Career's runner.
 *
 * Career work runs through the custody engine, on the representative's own
 * stream. The engine validates and records; this file only hands work over.
 */

import { CustodyEngine } from "../../custody/engine.ts";
import type {
  AcceptInput,
  AcceptResult,
  AnswerInput,
  CapabilityRunner,
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
};

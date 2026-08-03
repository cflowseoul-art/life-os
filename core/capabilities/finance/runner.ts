/**
 * Finance's runner.
 *
 * Finance reads the Dugong Ledger, reports what it finds, and is woken by the
 * schedule at month start or when the ledger changes. Its Asks are answered
 * here rather than through the custody engine, because Finance runs outside it.
 */

import { randomUUID } from "node:crypto";

import { advanceFinanceFromLedger } from "../../company/finance-runner.ts";
import { checkFinancePolicies } from "../../company/finance-watch.ts";
import type {
  AcceptInput,
  AcceptResult,
  AnswerInput,
  CapabilityRunner,
  TickInput,
} from "../../company/runner.ts";

function splitSubject(subject: string): { company: string; role: string } {
  const parts = subject.split(/[·|,\-—]/).map((p) => p.trim()).filter((p) => p !== "");
  return { company: parts[0] ?? "", role: parts.slice(1).join(" ") };
}

export const runner: CapabilityRunner = {
  id: "finance",

  async accept({ log, subject, request, attachment }: AcceptInput): Promise<AcceptResult> {
    const { company, role } = splitSubject(subject);

    log.append(
      {
        type: "HandedOver",
        holdId: randomUUID(),
        capability: "finance",
        handover: {
          company: company === "" ? subject.trim() || "명세" : company,
          role: role === "" ? "정기 결제 정리" : role,
          jdText: [attachment, request].join("\n").trim(),
        },
      },
      { kind: "user" },
      "finance",
      "ceo-office:accepted",
    );

    await advanceFinanceFromLedger(log);
    return { ok: true };
  },

  async answer({ log, ask, optionId }: AnswerInput): Promise<void> {
    log.append(
      { type: "AskAnswered", holdId: ask.holdId, askId: ask.id, optionId },
      { kind: "user" },
      "finance",
      "computer",
    );

    await advanceFinanceFromLedger(log);
  },

  async tick({ log, now }: TickInput): Promise<void> {
    await checkFinancePolicies(log, now);
  },
};

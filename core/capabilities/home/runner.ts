/**
 * Home's runner.
 *
 * A receipt or a depletion statement is recorded and worked through in one
 * step: nothing here needs the representative, so nothing stops to ask.
 */

import { randomUUID } from "node:crypto";

import { advanceHome } from "../../company/home-runner.ts";
import type { AcceptInput, AcceptResult, CapabilityRunner } from "../../company/runner.ts";

function splitSubject(subject: string): { company: string; role: string } {
  const parts = subject.split(/[·|,\-—]/).map((p) => p.trim()).filter((p) => p !== "");
  return { company: parts[0] ?? "", role: parts.slice(1).join(" ") };
}

export const runner: CapabilityRunner = {
  id: "home",

  accept({ log, subject, request, attachment }: AcceptInput): AcceptResult {
    const { company, role } = splitSubject(subject);

    log.append(
      {
        type: "HandedOver",
        holdId: randomUUID(),
        capability: "home",
        handover: {
          company: company === "" ? subject.trim() || "영수증" : company,
          role: role === "" ? "영수증 정리" : role,
          jdText: [attachment, request].join("\n").trim(),
        },
      },
      { kind: "user" },
      "home",
      "ceo-office:accepted",
    );

    advanceHome(log);
    return { ok: true };
  },
};

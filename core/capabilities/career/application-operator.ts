/**
 * The Application Operator's runner.
 *
 * Owns operations: which applications exist and where each stands. It answers
 * from the record and asks the representative nothing — a question about the
 * whole list answered with "which company?" is the department admitting it does
 * not know its own files.
 *
 * It reads no posting, writes no document, and scores no fit. When there are no
 * records it says so, rather than asking for a posting: a posting is the Job Fit
 * Analyst's input, and requesting one here would make the representative do the
 * operator's job to get an answer about their own search.
 *
 * Adding and editing applications is not implemented. The operator reports what
 * knowledge holds; nothing yet puts anything there.
 */

import { randomUUID } from "node:crypto";

import { readQuery, reportApplications } from "./applications.ts";
import { careerKnowledgeFor } from "./knowledge/provider.ts";
import type { ApplicationReport } from "./applications.ts";
import type { ArtifactSection } from "../../events/types.ts";

import type {
  AcceptInput,
  AcceptResult,
  ResponsibilityRunner,
} from "../../company/runner.ts";

const ACTOR = { kind: "capability" as const, id: "career" };

/** How many applications of one status are listed before the rest are counted. */
const SHOWN = 5;

/** Grouped by status, conclusions only. No posting, and nothing asked back. */
function sections(report: ApplicationReport): ArtifactSection[] {
  if (report.empty) {
    return [{
      heading: "기록된 지원 내역이 없습니다",
      body: "지원한 곳이 생기면 그때부터 현황을 정리해 올리겠습니다.",
      derivedFrom: [],
    }];
  }

  if (report.total === 0) {
    return [{
      heading: report.summary,
      body: "다른 상태의 지원 건은 지원현황으로 확인하실 수 있습니다.",
      derivedFrom: [],
    }];
  }

  return report.groups.map((group) => {
    const listed = group.applications.slice(0, SHOWN);
    const rest = group.applications.length - listed.length;

    const names = listed
      .map((a) => `${a.company} · ${a.position}${a.interviewAt ? ` (${a.interviewAt})` : ""}`)
      .join(", ");

    return {
      heading: `${group.label} ${String(group.applications.length)}건`,
      body: rest > 0 ? `${names} 외 ${String(rest)}건` : names,
      derivedFrom: [],
    };
  });
}

export const runner: ResponsibilityRunner = {
  responsibility: "career.application_operator",

  /**
   * Takes a status question. The subject is the question itself, so there is no
   * company to split out and none is required.
   */
  accept({ actor, log, subject, request, attachment }: AcceptInput): AcceptResult {
    const asked = [subject, request, attachment].join("\n").trim();
    if (asked === "") return { ok: false, reasons: ["무엇을 확인해 드릴지 알 수 없습니다."] };

    const query = readQuery(asked) ?? { kind: "all" as const };
    const holdId = randomUUID();

    log.append(
      {
        type: "HandedOver",
        holdId,
        capability: "career",
        // The question stands in for the subject: an operations query is not
        // about one company, so there is no company to record.
        handover: { company: "지원 현황", role: "확인", jdText: asked },
      },
      { kind: "user" },
      "career",
      "ceo-office:accepted",
    );

    const report = reportApplications(query, careerKnowledgeFor(actor));

    log.append(
      {
        type: "ArtifactKept",
        holdId,
        artifact: {
          id: `applications-${holdId}`,
          title: `지원 현황 — ${report.summary}`,
          sections: sections(report),
        },
      },
      ACTOR,
      "career",
      "career:applications",
    );

    return { ok: true };
  },
};

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
 * It is the only employee that writes application history. Movements are
 * appended, never overwritten: the previous fact stays exactly as recorded and
 * the sequence is the history.
 */

import { randomUUID } from "node:crypto";

import { findApplication, readQuery, reportApplications } from "./applications.ts";
import { readCommand } from "./application-commands.ts";
import { careerKnowledgeFor } from "./knowledge/provider.ts";
import { STATUS_LABEL } from "./knowledge/types.ts";
import type { ApplicationRecord, ApplicationReport } from "./applications.ts";
import type { ApplicationCommand } from "./application-commands.ts";
import type { ApplicationFact } from "./knowledge/types.ts";
import type { CareerKnowledge } from "./knowledge/index.ts";
import type { EventStream } from "../../storage/event-store.ts";
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

/**
 * The state a command moves an application to.
 *
 * The whole record is written each time, not a delta: a fact has to be readable
 * on its own years later (Art. 14), and a diff is not. Nothing is overwritten —
 * the previous fact stays exactly as recorded, and the sequence is the history.
 */
function nextState(
  command: ApplicationCommand,
  existing: ApplicationRecord | null,
  now: string,
): ApplicationFact["value"] {
  const base = existing ?? {
    company: command.company,
    position: "",
    status: "planned" as const,
    appliedAt: null,
    nextStep: null,
    interviewAt: null,
    interviewStage: null,
    memo: null,
    updatedAt: now,
  };

  if (command.kind === "memo") {
    return { ...base, company: base.company, memo: command.memo, updatedAt: now };
  }

  return {
    ...base,
    company: existing?.company ?? command.company,
    position: command.position ?? base.position,
    status: command.status,
    interviewStage: command.status === "interview" ? command.interviewStage : null,
    appliedAt: command.creates ? now.slice(0, 10) : base.appliedAt,
    updatedAt: now,
  };
}

/** After an update, only what moved. Never the whole record back. */
function movementSections(
  record: ApplicationRecord,
  previous: ApplicationRecord | null,
): ArtifactSection[] {
  return [
    { heading: `회사 · ${record.company}`, body: "", derivedFrom: [] },
    {
      heading: `직무 · ${record.position === "" ? "미기재" : record.position}`,
      body: "",
      derivedFrom: [],
    },
    {
      heading: `이전 상태 · ${previous ? STATUS_LABEL[previous.status] : "없음"}`,
      body: "",
      derivedFrom: [],
    },
    { heading: `현재 상태 · ${STATUS_LABEL[record.status]}`, body: "", derivedFrom: [] },
    { heading: `기록 ${String(record.history.length)}건`, body: "", derivedFrom: [] },
  ];
}

/** Writes the movement and reports it. The only place application facts are written. */
function record(
  input: { actor: AcceptInput["actor"]; log: EventStream; knowledge: CareerKnowledge },
  command: ApplicationCommand,
): AcceptResult {
  const { log, knowledge } = input;
  const position = command.kind === "status" ? command.position : null;
  const found = findApplication(knowledge, command.company, position);

  if (found && "ambiguous" in found) {
    return {
      ok: false,
      reasons: [
        `${command.company}에 지원한 기록이 ${String(found.matches.length)}건 있습니다. `
        + `직무까지 말씀해 주십시오 (${found.matches.map((m) => m.position).join(", ")}).`,
      ],
    };
  }

  const existing = found;

  if (command.kind === "status" && command.creates && existing) {
    // A planned application is one Career prepared and the representative had
    // not yet sent. "지원 완료" on it is the movement that was always going to
    // follow, not a second application — so it moves rather than duplicating,
    // and company, position and everything recorded so far carry forward.
    if (existing.status !== "planned") {
      return {
        ok: false,
        reasons: [
          `${existing.company}은(는) 이미 ${STATUS_LABEL[existing.status]} 상태로 기록돼 있습니다.`,
        ],
      };
    }
  }

  if ((command.kind === "memo" || !command.creates) && !existing) {
    return {
      ok: false,
      reasons: [`${command.company}에 지원한 기록이 없습니다. 먼저 지원 완료를 남겨 주십시오.`],
    };
  }

  const now = new Date().toISOString();
  const holdId = randomUUID();
  const state = nextState(command, existing, now);

  log.append(
    {
      type: "HandedOver",
      holdId,
      capability: "career",
      handover: { company: state.company, role: "지원 기록", jdText: "" },
    },
    { kind: "user" },
    "career",
    "ceo-office:accepted",
  );

  log.append(
    {
      type: "KnowledgeFactRecorded",
      holdId,
      fact: {
        id: `application-${holdId}`,
        type: "application",
        value: state,
        source: "대표님 말씀",
        // The representative reported the movement; the operator filed it.
        author: { kind: "representative" },
        acquiredAt: now,
        confidence: 1,
      },
    },
    { kind: "capability", id: "career" },
    "career",
    "career:applications",
  );

  // Read back through the same view, so the report reflects what was written.
  const updated = findApplication(knowledge, state.company, state.position);
  if (!updated || "ambiguous" in updated) return { ok: false, reasons: ["기록하지 못했습니다."] };

  log.append(
    {
      type: "ArtifactKept",
      holdId,
      artifact: {
        id: `application-${holdId}`,
        title: `${updated.company} · ${STATUS_LABEL[updated.status]}`,
        sections: movementSections(updated, existing),
      },
    },
    { kind: "capability", id: "career" },
    "career",
    "career:applications",
  );

  return { ok: true };
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

    const knowledge = careerKnowledgeFor(actor, log);

    // An instruction names a company; a question does not. "미리디 최종 탈락"
    // and "탈락한 곳 보여줘" share a word, and only the first says whose.
    const command = readCommand(asked);

    if (command && command.kind !== "refused") {
      return record({ log, knowledge }, command);
    }

    const query = readQuery(asked);

    // Neither a question nor a command that named anybody: "지원 취소" alone
    // says what to do and not to which application, and there is no safe guess.
    if (!query && command) return { ok: false, reasons: [command.reason] };

    const holdId = randomUUID();

    log.append(
      {
        type: "HandedOver",
        holdId,
        capability: "career",
        // The question stands in for the subject: an operations query is not
        // about one company, so there is no company to record. `jdText` stays
        // empty because nothing was handed over — a question is not a document,
        // and rendering it back as an attachment called it one.
        handover: { company: "지원 현황", role: "확인", jdText: "" },
      },
      { kind: "user" },
      "career",
      "ceo-office:accepted",
    );

    const report = reportApplications(query ?? { kind: "all" }, knowledge);

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

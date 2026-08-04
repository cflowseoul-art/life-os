/**
 * The Job Fit Analyst's runner.
 *
 * One employee, one responsibility. A posting arrives, the analyst reads it
 * against Career Knowledge, files a judgement, and asks the one question that is
 * genuinely the representative's: apply, hold, or skip.
 *
 * It stops there. It writes no résumé, proposes no positioning, and asks no
 * strategy question — those belong to employees who exist on the roster and have
 * no runner yet. When the representative decides to apply, the analyst records
 * the decision and says plainly that the next stage is not staffed. Doing the
 * strategist's work because the strategist is missing is how this department
 * became a document generator the first time.
 */

import { randomUUID } from "node:crypto";

import { project } from "../../custody/engine.ts";
import { employeeForResponsibility } from "../../company/employees.ts";
import { analyseFit, RECOMMENDATION_LABEL, UNSCORED_LABEL } from "./job-fit.ts";
import { careerKnowledgeFor } from "./knowledge/provider.ts";
import type { FitReport, RequirementMatch } from "./job-fit.ts";
import type { ArtifactSection } from "../../events/types.ts";

import type {
  AcceptInput,
  AcceptResult,
  AnswerInput,
  ResponsibilityRunner,
  ReviseInput,
} from "../../company/runner.ts";

const ACTOR = { kind: "capability" as const, id: "career" };

/** How many findings of one kind reach the report. The rest are counted, not listed. */
const SHOWN = 4;

/** The headline. Says which judgement was reached, or precisely why none was. */
function headline(report: FitReport): string {
  return report.unscored === null
    ? `적합도 ${String(report.percent ?? 0)}%`
    : `판단 불가 · ${UNSCORED_LABEL[report.unscored]}`;
}

function splitSubject(subject: string): { company: string; role: string } {
  const parts = subject.split(/[·|,\-—]/).map((p) => p.trim()).filter((p) => p !== "");
  return { company: parts[0] ?? "", role: parts.slice(1).join(" ") };
}

/** Conclusions only. The posting's own words never come back out. */
function sections(report: FitReport): ArtifactSection[] {
  const group = (label: string, matches: RequirementMatch[]): ArtifactSection[] =>
    matches.slice(0, SHOWN).map((m) => ({
      heading: `${label} · ${m.requirement}`,
      body: m.reason,
      derivedFrom: m.derivedFrom,
    }));

  const more = (label: string, matches: RequirementMatch[]): ArtifactSection[] =>
    matches.length > SHOWN
      ? [{
          heading: `${label} · 외 ${String(matches.length - SHOWN)}건`,
          body: "나머지는 근거에서 확인하실 수 있습니다.",
          derivedFrom: matches.slice(SHOWN).flatMap((m) => m.derivedFrom),
        }]
      : [];

  return [
    {
      heading: `${headline(report)} · ${RECOMMENDATION_LABEL[report.recommendation]}`,
      body: `${report.formula} ${report.reason}`,
      derivedFrom: [],
    },
    ...group("강한 일치", report.strong),
    ...more("강한 일치", report.strong),
    ...group("부분 일치", report.partial),
    ...more("부분 일치", report.partial),
    ...group("빈 곳", report.gaps),
    ...more("빈 곳", report.gaps),
    ...report.risks.slice(0, SHOWN).map((r) => ({
      heading: `위험 · ${r.statement}`,
      body: "",
      derivedFrom: r.derivedFrom,
    })),
  ];
}

export const runner: ResponsibilityRunner = {
  responsibility: "career.job_fit",

  accept({ actor, log, subject, request, attachment }: AcceptInput): AcceptResult {
    const { company, role } = splitSubject(subject);
    if (company === "" || role === "") {
      return { ok: false, reasons: ["회사가 비어 있습니다.", "직무가 비어 있습니다."] };
    }

    const posting = [attachment, request].join("\n").trim();
    if (posting === "") return { ok: false, reasons: ["채용공고 본문이 비어 있습니다."] };

    const holdId = randomUUID();
    const now = new Date().toISOString();
    // Resolved for authorship of the findings. The desk renders the signature.
    const analyst = employeeForResponsibility("career.job_fit");

    log.append(
      { type: "HandedOver", holdId, capability: "career", handover: { company, role, jdText: posting } },
      { kind: "user" },
      "career",
      "ceo-office:accepted",
    );

    // Resolved from the authenticated actor the boundary already established.
    // A representative the seed does not describe gets an empty view, never
    // somebody else's — and the analysis says so in its own terms.
    const knowledge = careerKnowledgeFor(actor);

    const report = analyseFit({ company, position: role, posting }, knowledge);

    // One fact per finding — bounded by what Career knows, never by how long the
    // posting is. `derivedFrom` points at the knowledge that supports it.
    const findings = [
      ...report.strong.map((m) => ({ m, kind: "strong" as const })),
      ...report.partial.map((m) => ({ m, kind: "partial" as const })),
      ...report.gaps.map((m) => ({ m, kind: "gap" as const })),
    ];

    findings.forEach(({ m, kind }, index) => {
      log.append(
        {
          type: "KnowledgeFactRecorded",
          holdId,
          fact: {
            id: `finding-${String(index + 1)}`,
            type: "fit_finding",
            value: { requirement: m.requirement, kind, reason: m.reason },
            source: `career-knowledge:${m.derivedFrom.join(",")}`,
            // The analyst concluded this; the knowledge only supported it.
            author: { kind: "employee", employeeId: analyst.id },
            acquiredAt: now,
            confidence: kind === "gap" ? 1 : 0.8,
            derivedFrom: m.derivedFrom,
          },
        },
        ACTOR,
        "career",
        "career:fit",
      );
    });

    log.append(
      {
        type: "ArtifactKept",
        holdId,
        artifact: {
          id: `fit-${company}-${role}`.replace(/\s+/g, "-"),
          title: `${company} · ${role} — ${headline(report)}`,
          sections: sections(report),
        },
      },
      ACTOR,
      "career",
      "career:fit",
    );

    // The only question at this stage, and the only one the analyst may ask.
    log.append(
      {
        type: "AskRaised",
        holdId,
        ask: {
          id: randomUUID(),
          holdId,
          question: `${company} ${role}, 지원하시겠습니까?`,
          facts: [
            `${headline(report)} · ${RECOMMENDATION_LABEL[report.recommendation]}`,
            report.reason,
            ...report.risks.slice(0, SHOWN).map((r) => `위험: ${r.statement}`),
          ],
          options: [
            { id: "apply", label: "지원한다", derivedFrom: [] },
            { id: "hold", label: "보류한다", derivedFrom: [] },
            { id: "skip", label: "지원하지 않는다", derivedFrom: [] },
          ],
          raisedAt: now,
        },
      },
      ACTOR,
      "career",
      "career:fit",
    );

    return { ok: true };
  },

  /**
   * The representative's decision is recorded, and the analyst's work ends.
   *
   * Apply does not start anything here. The Application Strategist owns what
   * follows and has no runner, so the honest report is that the decision is
   * held and the next stage is unstaffed — not a positioning question asked by
   * the wrong employee.
   */
  answer({ log, ask, optionId }: AnswerInput): void {
    const hold = project(log.read()).get(ask.holdId);
    const company = hold?.company ?? "";
    const role = hold?.role ?? "";

    log.append(
      { type: "AskAnswered", holdId: ask.holdId, askId: ask.id, optionId },
      { kind: "user" },
      "career",
      "computer",
    );

    const closing: Record<string, { title: string; heading: string; body: string }> = {
      apply: {
        title: "지원하기로 하셨습니다",
        heading: "지원 결정을 기록했습니다",
        body: "다음 단계는 아직 담당자가 배정되지 않았습니다. 준비되는 대로 이어서 올리겠습니다.",
      },
      hold: {
        title: "보류",
        heading: "보류로 두었습니다",
        body: "다시 보실 때 말씀해 주시면 그때 이어서 하겠습니다.",
      },
      skip: {
        title: "지원하지 않음",
        heading: "지원하지 않기로 하셨습니다",
        body: "이 공고는 여기서 마칩니다.",
      },
    };

    const chosen = closing[optionId];
    if (!chosen) return;

    log.append(
      {
        type: "ArtifactKept",
        holdId: ask.holdId,
        artifact: {
          id: `decided-${ask.holdId}`,
          title: `${company} · ${role} — ${chosen.title}`,
          sections: [{ heading: chosen.heading, body: chosen.body, derivedFrom: [] }],
        },
      },
      ACTOR,
      "career",
      "career:decided",
    );
  },

  /**
   * The representative wrote instead of choosing.
   *
   * Their words are recorded and the same question is put again. The analyst
   * does not reinterpret the posting on their behalf.
   */
  revise({ log, ask, feedback }: ReviseInput): void {
    log.append(
      { type: "RevisionRequested", holdId: ask.holdId, askId: ask.id, feedback },
      { kind: "user" },
      "career",
      "computer",
    );

    log.append(
      {
        type: "AskRaised",
        holdId: ask.holdId,
        ask: {
          id: randomUUID(),
          holdId: ask.holdId,
          question: ask.question,
          facts: [`대표님 말씀: ${feedback}`, "말씀 주신 내용을 두고 다시 여쭙습니다."],
          options: ask.options,
          raisedAt: new Date().toISOString(),
        },
      },
      ACTOR,
      "career",
      "revision",
    );
  },
};

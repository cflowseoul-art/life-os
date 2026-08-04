/**
 * Career's runner.
 *
 * Career work runs through the custody engine, on the representative's own
 * stream. The engine validates and records; this file only hands work over.
 */

import { CustodyEngine, project } from "../../custody/engine.ts";
import { employeeForDuty } from "../../company/employees.ts";
import { analyse, readProfile } from "./fit.ts";
import { statementOf } from "./facts.ts";
import { observe } from "./index.ts";
import { randomUUID } from "node:crypto";

import type {
  AcceptInput,
  AcceptResult,
  AnswerInput,
  CapabilityRunner,
  ReviseInput,
} from "../../company/runner.ts";

/** `회사 · 직무` is what the engine needs; the subject is where it is written. */
/**
 * The posting and the representative's own record arrive together.
 *
 * Everything after a 내 경험 / 프로필 / 이력서 marker is theirs; everything
 * before it is the employer's. Mixing the two is what made the old report
 * credit the representative with the employer's roadmap.
 */
const PROFILE_MARKER = /(^|\n)\s*(내 경험|프로필|이력서|경력)\s*[:\n]/;

function profileSection(text: string): string {
  const found = PROFILE_MARKER.exec(text);
  return found ? text.slice(found.index + found[0].length) : "";
}

function postingSection(text: string): string {
  const found = PROFILE_MARKER.exec(text);
  return found ? text.slice(0, found.index) : text;
}

function splitSubject(subject: string): { company: string; role: string } {
  const parts = subject.split(/[·|,\-—]/).map((p) => p.trim()).filter((p) => p !== "");
  return { company: parts[0] ?? "", role: parts.slice(1).join(" ") };
}

/**
 * A posting arrives and the fit analyst reads it — nobody writes a résumé yet.
 *
 * The stages are people: 박진로 measures fit, 이진로 chooses positioning after
 * the representative decides to apply, 윤진로 edits the résumé once positioning
 * is settled. Each runs only when its turn comes.
 */
export const runner: CapabilityRunner = {
  id: "career",

  accept({ log, subject, request, attachment }: AcceptInput): AcceptResult {
    const { company, role } = splitSubject(subject);
    if (company === "" || role === "") {
      return { ok: false, reasons: ["회사가 비어 있습니다.", "직무가 비어 있습니다."] };
    }

    const text = [attachment, request].join("\n").trim();
    if (text === "") return { ok: false, reasons: ["채용공고 본문이 비어 있습니다."] };

    const holdId = randomUUID();
    const now = new Date().toISOString();
    const analyst = employeeForDuty("career", "적합성 분석");
    const actor = { kind: "capability" as const, id: "career" };

    log.append(
      { type: "HandedOver", holdId, capability: "career", handover: { company, role, jdText: text } },
      { kind: "user" },
      "career",
      "ceo-office:accepted",
    );

    // The posting's requirements, and the profile the representative supplied.
    const requirements = observe({ company, role, jdText: postingSection(text) }, now);
    const profile = readProfile(profileSection(text));
    const fit = analyse(requirements.map((r) => r.value.statement), profile);

    for (const fact of requirements) {
      log.append({ type: "KnowledgeFactRecorded", holdId, fact }, actor, "career", "career");
    }

    log.append(
      {
        type: "ArtifactKept",
        holdId,
        artifact: {
          id: `fit-${company}-${role}`.replace(/\s+/g, "-"),
          title: `${company} · ${role} — 적합도 ${String(fit.percent)}%`,
          sections: [
            {
              heading: `적합도 ${String(fit.percent)}% · ${fit.recommendation}`,
              body: `${fit.formula}. ${fit.reason}`,
              derivedFrom: [],
            },
            ...fit.matches
              .filter((m) => m.kind === "strong")
              .map((m) => ({
                heading: `강한 일치 · ${m.requirement}`,
                body: `내 경험: ${m.evidence[0] ?? ""}`,
                derivedFrom: [],
              })),
            ...fit.matches
              .filter((m) => m.kind === "partial")
              .map((m) => ({
                heading: `부분 일치 · ${m.requirement}`,
                body: `겹치는 부분: ${m.shared.join(", ")}`,
                derivedFrom: [],
              })),
            ...fit.matches
              .filter((m) => m.kind === "gap")
              .map((m) => ({
                heading: `빈 곳 · ${m.requirement}`,
                body: "프로필에서 대응되는 경험을 찾지 못했습니다.",
                derivedFrom: [],
              })),
            {
              heading: `분석 · ${analyst.displayName} ${analyst.displayTitle}`,
              body: "이력서는 아직 손대지 않았습니다. 지원하기로 정하시면 그때 시작합니다.",
              derivedFrom: [],
            },
          ],
        },
      },
      actor,
      "career",
      "career:fit",
    );

    // The only question at this stage: is this worth applying to?
    log.append(
      {
        type: "AskRaised",
        holdId,
        ask: {
          id: randomUUID(),
          holdId,
          question: `${company} ${role}, 지원하시겠습니까?`,
          facts: [
            `적합도 ${String(fit.percent)}% · ${fit.recommendation}`,
            fit.formula,
            ...fit.matches.filter((m) => m.kind === "gap").map((m) => `빈 곳: ${m.requirement}`),
          ],
          options: [
            { id: "apply", label: "지원한다 — 전략부터 잡아 주십시오", derivedFrom: [] },
            { id: "hold", label: "보류한다 — 두고 보겠습니다", derivedFrom: [] },
            { id: "skip", label: "지원하지 않는다", derivedFrom: [] },
          ],
          raisedAt: now,
        },
      },
      actor,
      "career",
      "career:fit",
    );

    return { ok: true };
  },

  /**
   * The decision moves the work to the next person.
   *
   * 지원 → 이진로 proposes positioning. A positioning choice → 윤진로 writes the
   * résumé opening. 보류·미지원 → the work closes with that recorded.
   */
  answer({ log, ask, optionId }: AnswerInput): void {
    const now = new Date().toISOString();
    const actor = { kind: "capability" as const, id: "career" };
    const hold = project(log.read()).get(ask.holdId);
    const requirements = hold?.facts ?? [];
    const company = hold?.company ?? "";
    const role = hold?.role ?? "";

    log.append(
      { type: "AskAnswered", holdId: ask.holdId, askId: ask.id, optionId },
      { kind: "user" },
      "career",
      "computer",
    );

    if (optionId === "hold" || optionId === "skip") {
      log.append(
        {
          type: "ArtifactKept",
          holdId: ask.holdId,
          artifact: {
            id: `closed-${ask.holdId}`,
            title: `${company} · ${role} — ${optionId === "hold" ? "보류" : "지원하지 않음"}`,
            sections: [{
              heading: optionId === "hold" ? "보류로 두었습니다" : "지원하지 않기로 하셨습니다",
              body: "다시 보실 때 말씀해 주시면 그때 이어서 하겠습니다.",
              derivedFrom: [],
            }],
          },
        },
        actor,
        "career",
        "career:closed",
      );
      return;
    }

    if (optionId === "apply") {
      const strategist = employeeForDuty("career", "지원 전략");
      const top = requirements.slice(0, 3);

      log.append(
        {
          type: "AskRaised",
          holdId: ask.holdId,
          ask: {
            id: randomUUID(),
            holdId: ask.holdId,
            question: "어느 쪽으로 서겠습니까?",
            facts: [
              `${strategist.displayName} ${strategist.displayTitle}가 잡은 방향입니다.`,
              "고르신 방향으로 이력서 첫 문단을 씁니다.",
            ],
            options: top.map((o) => ({
              id: `strategy-${o.id}`,
              label: `${statementOf(o)}을(를) 앞세운다`,
              derivedFrom: [o.id],
            })),
            raisedAt: now,
          },
        },
        actor,
        "career",
        "career:strategy",
      );
      return;
    }

    // A positioning choice: the résumé editor's turn.
    const chosen = requirements.find((o) => `strategy-${o.id}` === optionId);
    const editor = employeeForDuty("career", "이력서 편집");

    log.append(
      {
        type: "ArtifactKept",
        holdId: ask.holdId,
        artifact: {
          id: `resume-${ask.holdId}`,
          title: `${company} · ${role} — 이력서 첫 문단`,
          sections: [
            {
              heading: `초안 · ${company} ${role} 지원자 〈이름〉입니다. `
                + `${chosen ? statementOf(chosen) : "핵심 경험"}에 해당하는 일을 〈어디서·언제〉 맡아 〈무엇을 바꿨는지〉 중심으로 말씀드리겠습니다.`,
              body: `${editor.displayName} ${editor.displayTitle} 작성 · 확정 전 초안입니다.`,
              derivedFrom: chosen ? [chosen.id] : [],
            },
          ],
        },
      },
      actor,
      "career",
      "career:resume",
    );
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
    const observations = hold?.facts ?? [];

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
            ...observations.map((o) => `· ${statementOf(o)}`),
          ],
          options: observations.map((o) => ({
            id: o.id,
            label: statementOf(o),
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

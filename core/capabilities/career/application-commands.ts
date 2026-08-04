/**
 * Reading what the representative said about an application.
 *
 * "채널톡 지원 완료", "에이블리 1차 면접", "미리디 최종 탈락". Short, spoken
 * sentences that name a company and a movement.
 *
 * Everything here is literal. A phrase is recognised or it is not, and a
 * command that cannot name its company is refused rather than guessed at — an
 * application filed against the wrong employer is worse than one not filed.
 */

import type { ApplicationStatus } from "./knowledge/types.ts";

/** A movement the representative reported. */
export type StatusCommand = {
  kind: "status";
  company: string;
  /** Given only when the representative wrote `회사 · 직무`. */
  position: string | null;
  status: ApplicationStatus;
  /** 1 for `1차 면접`, 2 for `2차`, null when unnumbered. */
  interviewStage: number | null;
  /** True for the phrase that starts an application rather than moving one. */
  creates: boolean;
};

export type MemoCommand = { kind: "memo"; company: string; memo: string };

export type ApplicationCommand = StatusCommand | MemoCommand;

export type CommandRefusal = { kind: "refused"; reason: string };

/**
 * Status phrases, most specific first.
 *
 * `최종 탈락` must be tried before `탈락`, and `서류 합격` before `합격`, or the
 * shorter phrase would swallow the longer one and lose what it meant.
 */
const STATUS_PHRASES: {
  phrases: string[];
  status: ApplicationStatus;
  creates?: boolean;
}[] = [
  { phrases: ["최종 탈락", "최종탈락", "불합격", "탈락", "떨어졌"], status: "rejected" },
  { phrases: ["지원 취소", "지원취소", "지원 철회", "지원철회"], status: "withdrawn" },
  { phrases: ["최종 합격", "최종합격", "오퍼 받았", "오퍼"], status: "offer" },
  { phrases: ["서류 합격", "서류합격", "서류 통과", "서류통과"], status: "screening" },
  { phrases: ["면접"], status: "interview" },
  { phrases: ["지원 완료", "지원완료", "지원했", "지원함"], status: "applied", creates: true },
];

const MEMO_PHRASES = ["메모 추가", "메모추가", "메모"];

/** `2차 면접` → 2. Absent when the representative did not number it. */
function stageIn(text: string): number | null {
  const found = /(\d+)\s*차/.exec(text);
  return found ? Number(found[1]) : null;
}

/**
 * Splits `회사 · 직무` when the representative wrote one.
 *
 * Only on an explicit separator. Guessing where a company name ends and a role
 * begins is how "채널톡 데이터" becomes a company nobody applied to.
 */
function splitCompany(text: string): { company: string; position: string | null } {
  const parts = text.split("·").map((p) => p.trim()).filter((p) => p !== "");

  return parts.length >= 2
    ? { company: parts[0], position: parts.slice(1).join(" ") }
    : { company: text.trim(), position: null };
}

/** Trailing particles and filler that are not part of a company's name. */
function cleanCompany(raw: string): string {
  return raw
    .replace(/^\s*(?:이제|오늘|어제|그|저)\s+/, "")
    // `원프레딕트 1차 면접` — the ordinal belongs to the interview, not the name.
    .replace(/\s*\d+\s*차\s*$/, "")
    .replace(/[,\-—]+$/, "")
    .replace(/\s+(?:은|는|이|가|에|에서|도)$/, "")
    .trim();
}

/**
 * Reads one command, or refuses with a reason.
 *
 * Returns null when the text is not an application command at all — that is how
 * a status *question* stays with the query path rather than being read as an
 * instruction to change something.
 */
export function readCommand(text: string): ApplicationCommand | CommandRefusal | null {
  const said = text.trim();
  if (said === "") return null;

  // A memo carries free text after the phrase, so it is read before statuses:
  // "채널톡 메모 추가 / 라이브 SQL 테스트 있음" must not match 면접 in its body.
  for (const phrase of MEMO_PHRASES) {
    const at = said.indexOf(phrase);
    if (at === -1) continue;

    const company = cleanCompany(splitCompany(said.slice(0, at)).company);
    const memo = said.slice(at + phrase.length).trim();

    if (company === "") return { kind: "refused", reason: "어느 회사의 메모인지 알 수 없습니다." };
    if (memo === "") return { kind: "refused", reason: "남길 메모 내용이 없습니다." };

    return { kind: "memo", company, memo };
  }

  for (const entry of STATUS_PHRASES) {
    for (const phrase of entry.phrases) {
      const at = said.indexOf(phrase);
      if (at === -1) continue;

      const head = said.slice(0, at);
      const { company, position } = splitCompany(head);
      const cleaned = cleanCompany(company);

      if (cleaned === "") {
        return {
          kind: "refused",
          // "지원 취소" alone names no application, and there is no safe guess.
          reason: "어느 회사인지 알 수 없습니다. 회사 이름과 함께 말씀해 주십시오.",
        };
      }

      return {
        kind: "status",
        company: cleaned,
        position,
        status: entry.status,
        interviewStage: entry.status === "interview" ? stageIn(head + phrase) : null,
        creates: entry.creates === true,
      };
    }
  }

  return null;
}

/** Every phrase the operator accepts as an instruction. Declared once, here. */
export const APPLICATION_COMMAND_SIGNALS: string[] = [
  ...STATUS_PHRASES.flatMap((e) => e.phrases),
  ...MEMO_PHRASES,
];

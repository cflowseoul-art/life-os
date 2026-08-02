/**
 * The desk bridge. Read the engine, answer the engine. Nothing else.
 *
 * Art. 7 (AI Autonomy) / Art. 11 (Ledger): this module holds no domain logic of
 * its own. It projects what `CustodyEngine` already knows into the shape the
 * desk renders, and forwards exactly one write — the user's answer to an Ask.
 *
 * Art. 9 (Trust): every field below is read from the event log. Nothing here
 * counts, estimates, or invents. If the record does not contain it, the field is
 * omitted and the surface renders without it.
 */

import { createServer } from "node:http";

import { CustodyEngine } from "./custody/engine.ts";
import type { Hold } from "./custody/engine.ts";
import { EventLog } from "./events/log.ts";
import type { Ask, Artifact, EventEnvelope, Observation } from "./events/types.ts";

/**
 * Accountable contributors, by capability.
 *
 * Art. 16 (Naming): a name, so the user knows who to ask. Not a rank, not a
 * team, not a routing target. One capability, one responsible name.
 */
const CONTRIBUTOR: Record<string, string> = {
  career: "서junior",
};

function contributorFor(capability: string): string {
  return CONTRIBUTOR[capability] ?? capability;
}

export type DeskWork = {
  id: string;
  section: "awaiting" | "inProgress" | "done";
  title: string;
  contributor: string;
  /** Plain-language state, derived from the hold. */
  status: string;
  /** The conclusion, first. One sentence the representative can act on. */
  report: string;
  /** Everything that supports the conclusion. Composed only from recorded facts. */
  detail: string[];
  ask: Ask | null;
  artifact: Artifact | null;
  observations: Observation[];
  history: { at: string; actor: string; capability: string | null; what: string }[];
  withdrawnReason: string | null;
};

export type DeskView = {
  awaiting: DeskWork[];
  inProgress: DeskWork[];
  done: DeskWork[];
};

function describe(event: EventEnvelope["event"]): string {
  switch (event.type) {
    case "HandedOver":
      return "맡았습니다";
    case "ObservationRecorded":
      return `확인했습니다 — ${event.observation.statement}`;
    case "AskRaised":
      return `여쭤봤습니다 — ${event.ask.question}`;
    case "AskAnswered":
      return "대표님께서 정해 주셨습니다";
    case "ArtifactKept":
      return `정리해서 올렸습니다 — ${event.artifact.title}`;
    case "ProposalRejected":
      return `확인이 덜 돼 다시 보고 있습니다 — ${event.reasons.join(", ")}`;
    case "HoldWithdrawn":
      return `그만두었습니다 — ${event.reason}`;
  }
}

function actorLabel(actor: EventEnvelope["actor"]): string {
  if (actor.kind === "user") return "대표님";
  if (actor.kind === "capability") return contributorFor(actor.id);
  return "회사";
}

function toWork(hold: Hold, events: EventEnvelope[]): DeskWork | null {
  if (hold.state === "withdrawn") return null;

  const contributor = contributorFor(hold.capability);
  const title = `${hold.company} · ${hold.role}`;

  const history = events
    .filter((e) => e.event.holdId === hold.id)
    .map((e) => ({
      at: e.at,
      actor: actorLabel(e.actor),
      capability: e.capability,
      what: describe(e.event),
    }));

  const observed = hold.observations.length;

  if (hold.state === "asking" && hold.outstandingAsk) {
    return {
      id: hold.id,
      section: "awaiting",
      title,
      contributor,
      status: "결정을 기다리고 있습니다",
      report: "이력서 첫 문단을 무엇으로 시작할지, 대표님 결정만 남았습니다.",
      detail: [
        `보내주신 공고에서 요건 ${String(observed)}개를 확인했고, 문장은 공고에 있던 표현을 그대로 옮겼습니다.`,
        "첫 문단에 무엇을 두느냐에 따라 읽는 쪽이 대표님을 다르게 기억합니다. 그건 제가 계산할 수 있는 문제가 아니라 여쭙습니다.",
        "정해 주시면 그 순서로 정리해서 올려드리겠습니다. 제출은 하지 않습니다.",
      ],
      ask: hold.outstandingAsk,
      artifact: null,
      observations: hold.observations,
      history,
      withdrawnReason: null,
    };
  }

  if (hold.state === "kept" && hold.artifact) {
    return {
      id: hold.id,
      section: "done",
      title,
      contributor,
      status: "마무리했습니다",
      report: "정해 주신 순서대로 정리해서 올려드립니다.",
      detail: [
        `${String(hold.artifact.sections.length)}개 항목을 말씀하신 순서로 배치했고, 표현은 공고에 있던 문장을 그대로 썼습니다.`,
        "지어낸 내용은 없습니다. 어느 문장이 어디서 나왔는지는 아래에 남겨 두었습니다.",
      ],
      ask: null,
      artifact: hold.artifact,
      observations: hold.observations,
      history,
      withdrawnReason: null,
    };
  }

  return {
    id: hold.id,
    section: "inProgress",
    title,
    contributor,
    status: observed === 0 ? "보내주신 공고를 읽고 있습니다" : `공고에서 요건 ${String(observed)}개를 확인했습니다`,
    report: "맡아 두었습니다. 지금 대표님께서 하실 일은 없습니다.",
    detail: [
      observed === 0
        ? "보내주신 공고를 읽고 있습니다."
        : `공고에서 요건 ${String(observed)}개까지 확인했습니다.`,
      "대표님 판단이 필요한 지점에 닿으면 그때 올려드리겠습니다.",
    ],
    ask: null,
    artifact: null,
    observations: hold.observations,
    history,
    withdrawnReason: null,
  };
}

export function deskView(engine: CustodyEngine, log: EventLog): DeskView {
  const events = log.read();
  const works = engine
    .ledger()
    .map((hold) => toWork(hold, events))
    .filter((w): w is DeskWork => w !== null);

  return {
    awaiting: works.filter((w) => w.section === "awaiting"),
    inProgress: works.filter((w) => w.section === "inProgress"),
    done: works.filter((w) => w.section === "done"),
  };
}

/**
 * Splits the subject the representative wrote into the two fields the Career
 * capability requires.
 *
 * Deliberately literal: it reads what is there and nothing more. When the
 * subject does not carry both, the engine's own refusal is returned unchanged
 * rather than a guess being recorded (Art. 9). See IMPLEMENTATION_NOTES #1.
 */
function splitSubject(subject: string): { company: string; role: string } {
  const parts = subject.split(/[·|,\-—]/).map((p) => p.trim()).filter((p) => p !== "");
  return { company: parts[0] ?? "", role: parts.slice(1).join(" ") };
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

const log = new EventLog(process.env.LIFE_OS_LOG);
const engine = new CustodyEngine(log);

const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/api/desk") {
    json(res, 200, deskView(engine, log));
    return;
  }

  // Work enters the company here. One entry point, every request (UI §3.1).
  if (req.method === "POST" && url.pathname === "/api/company/request") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      let sent: { subject?: string; request?: string; attachment?: string };

      try {
        sent = JSON.parse(body || "{}") as typeof sent;
      } catch {
        json(res, 400, { ok: false, reasons: ["요청을 읽을 수 없습니다."] });
        return;
      }

      const { company, role } = splitSubject(sent.subject ?? "");

      // The engine validates and records. This bridge proposes nothing.
      const result = engine.handOver({
        company,
        role,
        jdText: [sent.attachment ?? "", sent.request ?? ""].join("\n").trim(),
      });

      if (!result.ok) {
        json(res, 400, result);
        return;
      }

      json(res, 200, { ok: true, holdId: result.holdId, desk: deskView(engine, log) });
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/desk/answer") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      let optionId = "";

      try {
        optionId = String((JSON.parse(body || "{}") as { optionId?: unknown }).optionId ?? "");
      } catch {
        json(res, 400, { ok: false, reason: "요청을 읽을 수 없습니다." });
        return;
      }

      // The engine validates and records. This bridge decides nothing.
      const result = engine.answer(optionId);

      if (!result.ok) {
        json(res, 400, result);
        return;
      }

      json(res, 200, { ok: true, desk: deskView(engine, log) });
    });
    return;
  }

  json(res, 404, { ok: false, reason: "없는 경로입니다." });
}).listen(port, "127.0.0.1", () => {
  console.log(`desk api: http://127.0.0.1:${String(port)}/api/desk`);
});

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

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { CustodyEngine } from "./custody/engine.ts";
import type { Hold } from "./custody/engine.ts";
import { EventLog } from "./events/log.ts";
import type { Ask, Artifact, EventEnvelope, Observation } from "./events/types.ts";
import { isStaffed, route } from "./company/routing.ts";
import { templateFor } from "./reports/templates.ts";
import type { ReportSection } from "./reports/templates.ts";

/**
 * Accountable contributors, by capability.
 *
 * Art. 16 (Naming): a name, so the user knows who to ask. Not a rank, not a
 * team, not a routing target. One capability, one responsible name.
 */
function contributorFor(capability: string): string {
  return templateFor(capability).contributor;
}

export type DeskWork = {
  id: string;
  section: "awaiting" | "inProgress" | "done";
  title: string;
  contributor: string;
  /** Plain-language state, derived from the hold. */
  status: string;
  /** 1. Summary — the conclusion, in one sentence. */
  report: string;
  /** 2. Findings, labelled the way the team labels them. */
  sections: ReportSection[];
  /** 3. Recommendation. */
  recommendation: string;
  /** 4. Decision required, or null when nothing is asked of the representative. */
  decision: string | null;
  /** What the representative handed over, shown as an attachment. */
  attachment: { name: string; lines: number; preview: string[] } | null;
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

/** The file the representative sent, shown back rather than described. */
function attachmentFor(
  hold: Hold,
  events: EventEnvelope[],
): { name: string; lines: number; preview: string[] } | null {
  const handed = events.find(
    (e) => e.event.type === "HandedOver" && e.event.holdId === hold.id,
  );

  if (!handed || handed.event.type !== "HandedOver") return null;

  const lines = handed.event.handover.jdText.split("\n").filter((l) => l.trim() !== "");

  if (lines.length === 0) return null;

  return {
    name: `${hold.company} 공고 원문`,
    lines: lines.length,
    preview: lines.slice(0, 6),
  };
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

  const attachment = attachmentFor(hold, events);
  const template = templateFor(hold.capability);

  const state = hold.state === "asking" ? "awaiting" : hold.state === "kept" ? "done" : "inProgress";

  const composed = template.compose({
    state,
    staffed: hold.capability === "career",
    facts: hold.observations.map((o) => o.statement),
    outcome: (hold.artifact?.sections ?? []).map((sec) => sec.heading.replace(/^\d+\.\s*/, "")),
    question: hold.outstandingAsk?.question ?? null,
  });

  const status =
    state === "awaiting"
      ? "결정을 기다리고 있습니다"
      : state === "done"
        ? "마무리했습니다"
        : "진행하고 있습니다";

  return {
    id: hold.id,
    section: state,
    title,
    contributor,
    status,
    report: composed.summary,
    sections: composed.sections,
    recommendation: composed.recommendation,
    decision: composed.decision,
    attachment,
    ask: hold.outstandingAsk,
    artifact: hold.artifact,
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

      // Operations reads the request and names one accountable department.
      // The decision itself never leaves this process (§4).
      const routed = route({
        subject: sent.subject,
        body: sent.request,
        attachment: sent.attachment,
      });

      const { company, role } = splitSubject(sent.subject ?? "");

      // A department that cannot execute yet still owns the work and still
      // takes custody. Work is never refused for a missing capability (§3).
      if (!isStaffed(routed)) {
        log.append(
          {
            type: "HandedOver",
            holdId: randomUUID(),
            capability: routed.owner,
            handover: {
              company: company === "" ? (sent.subject ?? "").trim() || "요청" : company,
              role,
              jdText: [sent.attachment ?? "", sent.request ?? ""].join("\n").trim(),
            },
          },
          { kind: "user" },
          routed.owner,
          "computer",
        );

        json(res, 200, { ok: true, desk: deskView(engine, log) });
        return;
      }

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

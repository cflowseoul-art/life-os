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

import { staticSite } from "./infrastructure/http/static.ts";

import { allowlistEmpty, isAllowed } from "./identity/allowlist.ts";
import { verifyGoogleIdToken } from "./identity/google.ts";
import { contextFor, resolveOrCreate } from "./identity/onboarding.ts";
import { FileIdentityStore } from "./identity/store.ts";
import type { IdentityStore } from "./identity/store.ts";
import { FileEventStore } from "./storage/event-store.ts";
import type { EventStore } from "./storage/event-store.ts";
import { PostgresIdentityStore } from "./infrastructure/db/identity-store.ts";
import { PostgresEventStore, markReportRead, readReports } from "./infrastructure/db/event-store.ts";
import { ensureSchema } from "./infrastructure/db/init.ts";
import {
  CAPABILITIES,
  companyRoster,
  isEnabled,
  producesReports,
  runnerModuleFor,
  scheduled,
  scopeOf,
  validateManifest,
} from "./company/manifest.ts";
import { loadRunner } from "./company/runner.ts";
import { runSchedule } from "./company/schedule.ts";

/** Loads every declared runner once, so a missing one fails at boot. */
async function warmRunners(): Promise<void> {
  for (const capability of CAPABILITIES.filter((c) => c.enabled)) {
    await loadRunner(capability.id, runnerModuleFor(capability.id));
  }
}
import type { ActorContext } from "./identity/types.ts";
import {
  clearedCookie,
  cookieValue,
  issueSession,
  readSession,
  SESSION_COOKIE,
  sessionCookie,
} from "./identity/session.ts";

import { CustodyEngine, project } from "./custody/engine.ts";
import type { Hold } from "./custody/engine.ts";
import { EventLog } from "./events/log.ts";
import type { Ask, Artifact, EventEnvelope, Observation } from "./events/types.ts";
import { continueProjects } from "./company/continuation.ts";
import { OcrFailed, OcrUnavailable, readImage } from "./infrastructure/ocr/index.ts";
import { readReceipt } from "./capabilities/home/index.ts";
import { detectProjects, projectFor } from "./company/projects.ts";
import type { Project } from "./company/projects.ts";
import { isStaffed, route } from "./company/routing.ts";
import { signature } from "./company/employees.ts";
import { projectWorkOrders, workOrderFor } from "./company/work-order.ts";
import type { WorkOrder } from "./company/work-order.ts";
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
  /** The person who signs this report. */
  contributor: string;
  /** Their title, e.g. "팀장". The department is metadata only. */
  contributorTitle: string;
  /** The department, as the representative reads it. Metadata. */
  departmentLabel: string;
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
  /** The project this belongs to, when the company recognised one. */
  project: { id: string; name: string } | null;
  /** Where this piece of work stands as a company work item. */
  workOrder: { id: string; state: string; assignee: string; acceptedAt: string } | null;
  ask: Ask | null;
  artifact: Artifact | null;
  observations: Observation[];
  history: { at: string; actor: string; capability: string | null; what: string }[];
  withdrawnReason: string | null;
};

export type DeskView = {
  /** The company as it stands today. One roster, no screen-side copy. */
  employees: ReturnType<typeof companyRoster>;
  /** Every instruction the company took in, with where it stands. */
  workOrders: WorkOrder[];
  /** Recognised by the company, never created by the representative. */
  projects: Project[];
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
    case "RevisionRequested":
      return `대표님 말씀 — ${event.feedback}`;
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

function toWork(
  hold: Hold,
  events: EventEnvelope[],
  projects: Project[],
  orders: WorkOrder[],
): DeskWork | null {
  if (hold.state === "withdrawn") return null;

  const contributor = contributorFor(hold.capability);
  const sign = signature(hold.capability);
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
    staffed: isEnabled(hold.capability) && producesReports(hold.capability),
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
    contributor: sign.name,
    contributorTitle: sign.title,
    departmentLabel: sign.displayDepartment,
    status,
    report: composed.summary,
    sections: composed.sections,
    recommendation: composed.recommendation,
    decision: composed.decision,
    attachment,
    workOrder: (() => {
      const order = workOrderFor(orders, hold.id);
      return order
        ? { id: order.id, state: order.state, assignee: order.assignee.name, acceptedAt: order.acceptedAt }
        : null;
    })(),
    project: (() => {
      const p = projectFor(projects, hold.id);
      return p ? { id: p.id, name: p.name } : null;
    })(),
    ask: hold.outstandingAsk,
    artifact: hold.artifact,
    observations: hold.observations,
    history,
    withdrawnReason: null,
  };
}

export function deskView(engine: CustodyEngine, logs: EventLog[]): DeskView {
  // Household stream + this person's own. Another member's personal stream is
  // not readable here, so it cannot appear however the projection is written.
  const events = logs
    .flatMap((l) => l.read())
    .sort((a, b) => a.at.localeCompare(b.at));
  const projects = detectProjects(events);
  // The order exists before any department result is read.
  const workOrders = projectWorkOrders(events);
  const works = [...project(events).values()]
    .map((hold) => toWork(hold, events, projects, workOrders))
    .filter((w): w is DeskWork => w !== null);

  return {
    employees: companyRoster(),
    workOrders,
    projects,
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

// The company refuses to start if its own description is inconsistent, or if a
// capability it says is runnable has no runner behind it.
validateManifest();
void warmRunners();


/**
 * The composition root.
 *
 * `LIFE_OS_STORAGE=postgres` runs on the hosted database; `file` keeps the
 * local development adapters. Domain behaviour is identical either way — only
 * where the bytes live differs.
 */
const STORAGE = process.env.LIFE_OS_STORAGE ?? "file";
const hosted = STORAGE === "postgres";

const identity: IdentityStore = hosted ? new PostgresIdentityStore() : new FileIdentityStore();
const events: EventStore = hosted ? new PostgresEventStore() : new FileEventStore();

console.log(`storage: ${STORAGE}`);

/** Everything a request needs, resolved from the actor and nothing else. */
function desk(actor: ActorContext) {
  const household = events.logFor(actor, "household");
  const personal = events.logFor(actor, "personal");
  const readable = events.readableFor(actor);
  const streams = events.prepare(actor);

  return {
    household,
    personal,
    readable,
    /** Load before, flush after. A file adapter does nothing for either. */
    load: () => streams.load(),
    flush: () => streams.flush(),
    /** Career is personal, so the custody engine runs on the personal stream. */
    engine: new CustodyEngine(personal),
    logFor: (capability: string) => (scopeOf(capability) === "household" ? household : personal),
    /** The outstanding question and which capability raised it. */
    outstandingAsk: () => {
      const holds = [...project(readable.flatMap((l) => l.read())).values()];
      const asking = holds.find((h) => h.outstandingAsk !== null);
      return asking?.outstandingAsk
        ? { ask: asking.outstandingAsk, capability: asking.capability }
        : null;
    },
    view: () => deskView(new CustodyEngine(personal), readable),
  };
}

/**
 * The authentication boundary.
 *
 * Everything past this line receives an `ActorContext` and nothing else — no
 * cookies, no tokens, no knowledge that Google exists.
 */
async function actorFrom(req: import("node:http").IncomingMessage): Promise<ActorContext | null> {
  const session = readSession(cookieValue(req.headers.cookie, SESSION_COOKIE));
  return session ? contextFor(identity, session) : null;
}

function body(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });
    req.on("end", () => { resolve(text); });
  });
}
// The scheduled check needs a household to check for, and a household comes
// from an actor. Re-enabled in the next milestone, when a background runner can
// resolve one without a request. See MIGRATION note.

const port = Number(process.env.PORT ?? 3000);

// One origin: the API answers /api/*, the build answers everything else.
const site = staticSite();
console.log(site ? "web: frontend/dist" : "web: (build 없음 — Vite 개발 서버 사용)");

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/healthz") {
    json(res, 200, { ok: true, storage: STORAGE });
    return;
  }

  // ── Authentication ─────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/api/auth/google") {
    void (async () => {
      try {
        const sent = JSON.parse((await body(req)) || "{}") as { credential?: string; householdId?: string };
        if (!sent.credential) { json(res, 400, { ok: false, reason: "로그인 정보가 오지 않았습니다." }); return; }

        const verified = await verifyGoogleIdToken(sent.credential);

        // Entry is decided here, before anything is created. The list is
        // server-side only and there is no way to add to it from outside.
        if (allowlistEmpty()) {
          json(res, 403, { ok: false, reason: "아직 허용된 계정이 없습니다." });
          return;
        }

        if (!isAllowed(verified.email, verified.emailVerified)) {
          json(res, 403, { ok: false, reason: "이 계정으로는 들어오실 수 없습니다." });
          return;
        }

        const { userId, householdId } = await resolveOrCreate(identity, verified, sent.householdId);
        const token = issueSession(userId, householdId);
        const context = await contextFor(identity, readSession(token)!);

        res.setHeader("set-cookie", sessionCookie(token));
        json(res, 200, {
          ok: true,
          user: context && { displayName: context.user.displayName, email: context.user.email },
          household: context && { name: context.household.name },
        });
      } catch (error) {
        json(res, 401, { ok: false, reason: error instanceof Error ? error.message : "로그인하지 못했습니다." });
      }
    })();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    void actorFrom(req).then((context) => {
      json(res, 200, context
        ? {
            ok: true,
            user: { displayName: context.user.displayName, email: context.user.email },
            household: { name: context.household.name, isOwner: context.household.ownerUserId === context.user.id },
          }
        : { ok: false });
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/signout") {
    res.setHeader("set-cookie", clearedCookie());
    json(res, 200, { ok: true });
    return;
  }

  // ── Everything below requires an identity ──────────────────────────────
  if (url.pathname.startsWith("/api/")) {
    void actorFrom(req).then((context) => {
      if (!context) { json(res, 401, { ok: false, reason: "로그인이 필요합니다." }); return; }

      // Streams are loaded before any runner reads them, and flushed after the
      // response is composed. Runners stay synchronous and know nothing of it.
      const ctx = desk(context);
      void ctx
        .load()
        .then(() => { handle(req, res, url, context, ctx); })
        .catch(() => { json(res, 500, { ok: false, reason: "지금은 열어드리지 못했습니다." }); });
    });
    return;
  }

  // Anything that is not an API route is the application itself.
  if (site?.(req, res, url)) return;

  json(res, 404, { ok: false, reason: "없는 경로입니다." });
});

// Nothing is served until the database can answer for itself: a login that
// arrived first would fail on a missing table.
void (hosted ? ensureSchema() : Promise.resolve())
  .then(() => {
    server.listen(port, process.env.HOST ?? "127.0.0.1", () => {
      console.log(`desk api: :${String(port)}/api/desk`);
    });
  })
  .catch((error: unknown) => {
    console.error("스키마를 준비하지 못했습니다:", error instanceof Error ? error.message : error);
    process.exit(1);
  });

/** Domain routes. They receive the actor; they never parse a request for it. */
function handle(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  url: URL,
  actor: ActorContext,
  ctx: ReturnType<typeof desk>,
): void {
  const engine = ctx.engine;

  if (req.method === "POST" && url.pathname === "/api/desk/read") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      const holdId = String((JSON.parse(body || "{}") as { holdId?: unknown }).holdId ?? "");

      if (!hosted || holdId === "") { json(res, 200, { ok: true }); return; }

      void markReportRead(actor.user.id, holdId)
        .then(() => { json(res, 200, { ok: true }); })
        .catch(() => { json(res, 200, { ok: true }); });
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/desk/read") {
    void (hosted ? readReports(actor.user.id) : Promise.resolve([]))
      .then((holdIds) => { json(res, 200, { ok: true, holdIds }); })
      .catch(() => { json(res, 200, { ok: true, holdIds: [] }); });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/desk") {
    // Month start and ledger changes are noticed here, because this is where a
    // household context exists. Which capabilities wake is the manifest's call.
    void runSchedule("household", actor, ctx.logFor)
      .catch(() => undefined)
      .then(() => ctx.flush())
      .then(() => { json(res, 200, ctx.view()); });
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

      // The manifest names the runner; the desk never learns which capability
      // answered. Adding a capability changes nothing here.
      if (routed.capability) {
        void loadRunner(routed.capability, runnerModuleFor(routed.capability))
          .then((runner) =>
            runner.accept({
              actor,
              log: ctx.logFor(routed.capability!),
              subject: sent.subject ?? "",
              request: sent.request ?? "",
              attachment: sent.attachment ?? "",
            }),
          )
          .then((result) => {
            if (result.ok) void ctx.flush().then(() => { json(res, 200, { ok: true, desk: ctx.view() }); });
            else json(res, 400, result);
          })
          .catch((error: unknown) => {
            json(res, 500, {
              ok: false,
              reasons: [error instanceof Error ? error.message : "처리하지 못했습니다."],
            });
          });
        return;
      }

      // A department with no runner still owns the work and still reports that
      // it cannot execute yet. Work is never refused for a missing capability,
      // and its stream is the one its scope declares.
      ctx.logFor(routed.owner).append(
        {
          type: "HandedOver",
          holdId: randomUUID(),
          capability: routed.owner,
          handover: {
            company: (sent.subject ?? "").trim() || "요청",
            role: routed.owner,
            jdText: [sent.attachment ?? "", sent.request ?? ""].join("\n").trim(),
          },
        },
        { kind: "user" },
        routed.owner,
        "ceo-office:accepted",
      );

      void ctx.flush().then(() => { json(res, 200, { ok: true, desk: ctx.view() }); });
    });
    return;
  }

  // A receipt photo. OCR happens here, at the edge; everything downstream is
  // the same text path the parser already handles.
  if (req.method === "POST" && url.pathname === "/api/company/receipt") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      let sent: { store?: string; image?: string; extension?: string };

      try {
        sent = JSON.parse(body || "{}") as typeof sent;
      } catch {
        json(res, 400, { ok: false, reasons: ["사진을 읽지 못했습니다."] });
        return;
      }

      if (!sent.image) {
        json(res, 400, { ok: false, reasons: ["사진이 오지 않았습니다."] });
        return;
      }

      let text: string;

      try {
        text = readImage(Buffer.from(sent.image, "base64"), sent.extension ?? ".jpg");
      } catch (error) {
        // Nothing is recorded. No hold, no inventory, no expense (Art. 3, 9).
        const reason =
          error instanceof OcrUnavailable
            ? "지금 서버에서는 사진을 읽지 못합니다. 영수증 내용을 붙여넣어 주시면 그대로 정리하겠습니다."
            : error instanceof OcrFailed
              ? "사진에서 글자를 읽지 못했습니다. 다시 찍어 보내주시거나, 내용을 붙여넣어 주십시오."
              : "사진을 읽지 못했습니다.";

        json(res, 400, { ok: false, reasons: [reason] });
        return;
      }

      // Read but unparseable is also a failure: an empty receipt is not a
      // purchase, and recording one would invent a fact.
      if (readReceipt(text).items.length === 0) {
        json(res, 400, {
          ok: false,
          reasons: ["영수증에서 품목을 찾지 못했습니다. 다시 찍어 보내주시거나, 내용을 붙여넣어 주십시오."],
        });
        return;
      }

      const store = (sent.store ?? "").trim() || text.split("\n")[0].trim() || "영수증";

      // OCR happens at the edge; the text is handed to whichever capability
      // owns receipts, named by routing rather than by this file.
      const owner = route({ subject: store, body: "영수증 정리", attachment: text }).capability;

      if (!owner) {
        json(res, 400, { ok: false, reasons: ["영수증을 맡을 팀이 준비되지 않았습니다."] });
        return;
      }

      void loadRunner(owner, runnerModuleFor(owner))
        .then((runner) =>
          runner.accept({ actor, log: ctx.logFor(owner), subject: store, request: "영수증 정리", attachment: text }),
        )
        .then(() => { void ctx.flush().then(() => { json(res, 200, { ok: true, desk: ctx.view() }); }); })
        .catch(() => { json(res, 500, { ok: false, reasons: ["영수증을 정리하지 못했습니다."] }); });
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/desk/revise") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      const feedback = String((JSON.parse(body || "{}") as { feedback?: unknown }).feedback ?? "").trim();

      if (feedback === "") {
        json(res, 400, { ok: false, reason: "어떤 점을 고칠지 적어 주십시오." });
        return;
      }

      const outstanding = ctx.outstandingAsk();

      if (!outstanding) {
        json(res, 400, { ok: false, reason: "지금은 여쭌 것이 없습니다." });
        return;
      }

      const owner = outstanding.capability;

      void loadRunner(owner, runnerModuleFor(owner))
        .then((runner) => {
          if (!runner.revise) throw new Error("이 건은 아직 수정 요청을 받지 못합니다.");
          return runner.revise({ actor, log: ctx.logFor(owner), ask: outstanding.ask, feedback });
        })
        .then(() => ctx.flush())
        .then(() => { json(res, 200, { ok: true, desk: ctx.view() }); })
        .catch((error: unknown) => {
          json(res, 400, {
            ok: false,
            reason: error instanceof Error ? error.message : "말씀을 전하지 못했습니다.",
          });
        });
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

      // The capability that raised the question answers it. Which capability
      // that is comes from the record; its runner comes from the manifest. The
      // desk does not know, and does not need to.
      const outstanding = ctx.outstandingAsk();

      if (outstanding) {
        if (!outstanding.ask.options.some((o) => o.id === optionId)) {
          json(res, 400, { ok: false, reason: "선택지에 없는 답변입니다." });
          return;
        }

        const owner = outstanding.capability;

        void loadRunner(owner, runnerModuleFor(owner))
          .then((runner) =>
            runner.answer?.({
              actor,
              log: ctx.logFor(owner),
              ask: outstanding.ask,
              optionId,
            }),
          )
          .then(() => {
            // Work may have completed. The owning department starts whatever
            // naturally follows, silently (§4).
            continueProjects(ctx.personal);
            void ctx.flush().then(() => { json(res, 200, { ok: true, desk: ctx.view() }); });
          })
          .catch((error: unknown) => {
            json(res, 400, {
              ok: false,
              reason: error instanceof Error ? error.message : "정하신 것을 남기지 못했습니다.",
            });
          });
        return;
      }

      json(res, 400, { ok: false, reason: "답변할 질문이 없습니다." });
      return;

    });
    return;
  }

  json(res, 404, { ok: false, reason: "없는 경로입니다." });
}

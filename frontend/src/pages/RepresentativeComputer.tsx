/**
 * The Representative Computer.
 *
 * Five places, an inbox of work orders, a reading pane of report blocks, and
 * the office as a second lens on the same data. Density from a mail client,
 * blocks from a document tool, state from an issue tracker, surfaces from the
 * pixel office — and none of them cloned.
 *
 * The dot means one thing: 대표님의 판단이 필요함. Looking does not clear it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./RepresentativeComputer.css";

type Observation = {
  id: string;
  statement: string;
  source: string;
  acquiredAt: string;
  confidence: number;
};

type AskOption = { id: string; label: string; derivedFrom: string[] };

type Ask = {
  id: string;
  holdId: string;
  question: string;
  facts: string[];
  options: AskOption[];
  raisedAt: string;
};

type Artifact = {
  id: string;
  title: string;
  sections: { heading: string; body: string; derivedFrom: string[] }[];
};

type WorkOrderRef = { id: string; state: string; assignee: string; acceptedAt: string };

type Work = {
  id: string;
  section: "awaiting" | "inProgress" | "done";
  title: string;
  contributor: string;
  contributorTitle?: string;
  departmentLabel?: string;
  status: string;
  report: string;
  sections?: { heading: string; bullets: string[] }[];
  recommendation?: string;
  decision?: string | null;
  attachment?: { name: string; lines: number; preview: string[] } | null;
  workOrder?: WorkOrderRef | null;
  ask: Ask | null;
  artifact: Artifact | null;
  observations: Observation[];
  history: { at: string; actor: string; capability: string | null; what: string }[];
  withdrawnReason: string | null;
};

type WorkOrder = {
  id: string;
  subject: string;
  department: string;
  assignee: { name: string; title: string; employeeId: string };
  state: string;
  acceptedAt: string;
  completedAt: string | null;
};

type Desk = { workOrders?: WorkOrder[]; awaiting: Work[]; inProgress: Work[]; done: Work[] };

type Place = "inbox" | "reports" | "outbox" | "calendar";

const PLACES: { id: Place; label: string; glyph: string }[] = [
  { id: "inbox", label: "받은 보고", glyph: "📥" },
  { id: "reports", label: "지난 보고", glyph: "📚" },
  { id: "outbox", label: "보낸 지시", glyph: "📤" },
  { id: "calendar", label: "일정", glyph: "📅" },
];

/** State words, read-only. The representative never sets one. */
const STATE_LABEL: Record<string, string> = {
  accepted: "접수",
  assigned: "배정",
  working: "진행 중",
  awaiting: "결정 필요",
  completed: "완료",
  withdrawn: "거둠",
};

function stateOf(work: Work): string {
  if (work.workOrder) return STATE_LABEL[work.workOrder.state] ?? work.status;
  return work.section === "awaiting" ? "결정 필요" : work.section === "done" ? "완료" : "진행 중";
}

function when(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

function lastMoved(work: Work): string {
  return when(work.history[work.history.length - 1]?.at);
}

/**
 * Provenance, said the way a person would say it. The record stores a pointer;
 * nobody outside the code should ever read that.
 */
function naturalSource(text: string): string {
  return text
    .replace(/handover\.jdText:(\d+)/g, "보내주신 공고 $1번째 줄")
    .replace(/^공고 원문 (.+) 에서 확인한 요건입니다\.$/, "$1에서 확인했습니다");
}

/** Refusals, said by a person rather than by a validator. */
function naturalRefusal(reason: string): string {
  if (reason.includes("회사") || reason.includes("직무")) {
    return "어느 회사, 어떤 자리인지까지 적어 주시면 바로 착수하겠습니다. (예: 토스 · 프로덕트 디자이너)";
  }
  if (reason.includes("본문")) return "공고 내용을 함께 주시면 그대로 읽고 정리하겠습니다.";
  return reason;
}

/** One work order, one row. */
function Row({ work, active, onOpen }: { work: Work; active: boolean; onOpen: () => void }) {
  const needs = work.section === "awaiting";

  return (
    <button
      type="button"
      className={`rc__row${needs ? " rc__row--needs" : ""}${active ? " rc__row--active" : ""}`}
      onClick={onOpen}
    >
      <span className="rc__sprite" aria-hidden>{work.contributor.slice(0, 1)}</span>

      <span className="rc__row-main">
        <span className="rc__row-top">
          <span className="rc__who">
            {needs && <span className="rc__dot" aria-label="결정 필요" />}
            {work.contributor}
            {work.contributorTitle && <span className="rc__title"> {work.contributorTitle}</span>}
          </span>
          <span className="rc__state">{stateOf(work)}</span>
          <span className="rc__when">{lastMoved(work)}</span>
        </span>

        <span className="rc__subject">
          {work.departmentLabel && <span className="rc__dept">{work.departmentLabel} · </span>}
          {work.title}
        </span>

        <span className="rc__snippet">{work.report}</span>
      </span>
    </button>
  );
}

function Reading({
  work,
  onBack,
  onDecide,
  busy,
}: {
  work: Work;
  onBack: () => void;
  onDecide: (optionId: string) => void;
  busy: boolean;
}) {
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <article className="rc__read">
      <button type="button" className="rc__back" onClick={onBack}>← 목록</button>

      <h1>{work.title}</h1>
      <p className="rc__meta">
        {work.contributor}
        {work.contributorTitle ? ` ${work.contributorTitle}` : ""}
        {work.departmentLabel ? ` · ${work.departmentLabel}` : ""} · {lastMoved(work)} · {stateOf(work)}
      </p>

      <div className="rc__blocks">
        <h2 className="rc__h">요약</h2>
        <p className="rc__lead">{work.report}</p>

        {(work.sections ?? []).map((sec) => (
          <div key={sec.heading}>
            <h2 className="rc__h">{sec.heading}</h2>
            <ul className="rc__bullets">
              {sec.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        ))}

        {work.attachment && (
          <div className="rc__attachment">
            <p className="rc__attachment-name">{work.attachment.name} · {work.attachment.lines}줄</p>
            <pre className="rc__attachment-preview">{work.attachment.preview.join("\n")}</pre>
          </div>
        )}

        {work.recommendation && (
          <>
            <h2 className="rc__h">제안</h2>
            <p>{work.recommendation}</p>
          </>
        )}

        {work.ask && (
          <>
            <h2 className="rc__h">결정 필요</h2>
            <p>{work.decision ?? work.ask.question}</p>
            <div className="rc__choices">
              {work.ask.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="rc__choice"
                  aria-pressed={choice === option.id}
                  onClick={() => { setChoice(option.id); }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="rc__actions">
              <button
                type="button"
                className="rc__btn"
                disabled={choice === null || busy}
                onClick={() => { if (choice) onDecide(choice); }}
              >
                승인
              </button>
              {/* No revision event exists in the engine. Inert, not pretending. */}
              <button type="button" className="rc__btn rc__btn--ghost" disabled>수정 요청</button>
            </div>
          </>
        )}

        {work.observations.length > 0 && (
          <details className="rc__more">
            <summary>근거 · 출처 {work.observations.length}건</summary>
            <ul className="rc__facts">
              {work.observations.map((o) => (
                <li key={o.id}>
                  {o.statement}
                  <span className="rc__src">
                    {naturalSource(o.source)} · {when(o.acquiredAt)}에 확인
                    {o.confidence < 1 && " · 미루어 본 것"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className="rc__more">
          <summary>진행 과정</summary>
          <ul className="rc__facts">
            {work.history.map((h, i) => (
              <li key={`${h.at}-${String(i)}`}>
                {h.what}
                <span className="rc__src">{when(h.at)} · {h.actor}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}

function Compose({
  onSend,
  onPhoto,
  onClose,
  busy,
  refusals,
}: {
  onSend: (v: { subject: string; request: string; attachment: string }) => void;
  onPhoto: (file: File, store: string) => void;
  onClose: () => void;
  busy: boolean;
  refusals: string[];
}) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState("");

  const send = () => {
    const [first, ...rest] = text.split("\n");
    onSend({ subject: first ?? "", request: rest.join("\n"), attachment });
  };

  return (
    <div className="rc__compose">
      <div className="rc__compose-bar">
        <button type="button" className="rc__icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        <span className="rc__compose-title">업무 보내기</span>
        <button
          type="button"
          className="rc__btn"
          disabled={busy || (text.trim() === "" && attachment.trim() === "")}
          onClick={send}
        >
          보내기
        </button>
      </div>

      <div className="rc__compose-body">
        <div className="rc__to">
          <span>받는 곳</span>
          <span>우리 회사 · 서비서 실장</span>
        </div>

        <textarea
          className="rc__write"
          rows={8}
          placeholder="무엇을 맡기시겠습니까? 평소 말씀하시듯 적어 주십시오."
          value={text}
          onChange={(e) => { setText(e.target.value); }}
        />

        <div className="rc__attach">
          <p className="rc__attach-label">첨부</p>
          <input
            type="file"
            accept="image/*"
            className="rc__file"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPhoto(file, text.split("\n")[0] ?? "");
            }}
          />
          <textarea
            className="rc__attach-box"
            rows={6}
            placeholder="공고나 문서가 있으시면 여기에 붙여 주십시오."
            value={attachment}
            onChange={(e) => { setAttachment(e.target.value); }}
          />
        </div>

        {refusals.length > 0 && (
          <ul className="rc__refusals">
            {[...new Set(refusals.map(naturalRefusal))].map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RepresentativeComputer() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [place, setPlace] = useState<Place>("inbox");
  const [drawer, setDrawer] = useState(false);
  const [composing, setComposing] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [released, setReleased] = useState(false);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/desk")
      .then((r) => r.json() as Promise<Desk>)
      .then(setDesk)
      .catch(() => { setError("지금은 열어드리지 못했습니다. 잠시 후 다시 들어와 주십시오."); });
  }, []);

  useEffect(load, [load]);

  const sendPhoto = useCallback((file: File, store: string) => {
    setBusy(true);
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] ?? "";
      const dot = file.name.lastIndexOf(".");

      fetch("/api/company/receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ store, image: base64, extension: dot > -1 ? file.name.slice(dot) : ".jpg" }),
      })
        .then((r) => r.json() as Promise<{ ok: boolean; desk?: Desk; reasons?: string[] }>)
        .then((result) => {
          if (result.ok && result.desk) {
            setDesk(result.desk);
            setRefusals([]);
            setComposing(false);
            setAccepted(true);
          } else {
            setRefusals(result.reasons ?? ["사진을 읽지 못했습니다."]);
          }
        })
        .catch(() => { setRefusals(["사진을 읽지 못했습니다."]); })
        .finally(() => { setBusy(false); });
    };

    reader.onerror = () => { setRefusals(["사진을 읽지 못했습니다."]); setBusy(false); };
    reader.readAsDataURL(file);
  }, []);

  const send = useCallback((v: { subject: string; request: string; attachment: string }) => {
    setBusy(true);
    fetch("/api/company/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(v),
    })
      .then((r) => r.json() as Promise<{ ok: boolean; desk?: Desk; reasons?: string[] }>)
      .then((result) => {
        if (result.ok && result.desk) {
          setDesk(result.desk);
          setRefusals([]);
          setComposing(false);
          setAccepted(true);
        } else {
          setRefusals(result.reasons ?? ["보내드리지 못했습니다."]);
        }
      })
      .catch(() => { setRefusals(["보내드리지 못했습니다."]); })
      .finally(() => { setBusy(false); });
  }, []);

  const decide = useCallback((optionId: string) => {
    setBusy(true);
    fetch("/api/desk/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId }),
    })
      .then((r) => r.json() as Promise<{ ok: boolean; desk?: Desk; reason?: string }>)
      .then((result) => {
        if (result.ok && result.desk) {
          setDesk(result.desk);
          setOpenId(null);
          setReleased(true);
        } else {
          setError(result.reason ?? "정하신 것을 남기지 못했습니다. 다시 한 번 눌러 주십시오.");
        }
      })
      .catch(() => { setError("정하신 것을 남기지 못했습니다. 다시 한 번 눌러 주십시오."); })
      .finally(() => { setBusy(false); });
  }, []);

  const all = useMemo(
    () => (desk ? [...desk.awaiting, ...desk.inProgress, ...desk.done] : []),
    [desk],
  );

  const q = query.trim();
  const matches = useCallback(
    (w: Work) => q === "" || `${w.title} ${w.contributor} ${w.report}`.includes(q),
    [q],
  );

  const listed = useMemo(() => {
    if (!desk) return [];
    if (place === "reports") return desk.done.filter(matches);
    if (place === "inbox") return [...desk.awaiting, ...desk.inProgress, ...desk.done].filter(matches);
    return [];
  }, [desk, place, matches]);

  // j / k / Enter / Esc — navigate, open, close. Nothing destructive.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (composing || document.activeElement === searchRef.current) return;

      if (e.key === "Escape") { setOpenId(null); setDrawer(false); return; }
      if (e.key === "j") setCursor((c) => Math.min(c + 1, Math.max(listed.length - 1, 0)));
      if (e.key === "k") setCursor((c) => Math.max(c - 1, 0));
      if (e.key === "Enter" && listed[cursor]) setOpenId(listed[cursor].id);
      if (["1", "2", "3", "4"].includes(e.key)) {
        setPlace(PLACES[Number(e.key) - 1].id);
        setOpenId(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [listed, cursor, composing]);

  if (error) return <main className="rc"><p className="rc__none">{error}</p></main>;
  if (!desk) return <main className="rc" />;

  const open = all.find((w) => w.id === openId);
  const orders = desk.workOrders ?? [];
  const sent = orders.filter((o) => o.state !== "completed" && o.state !== "withdrawn");

  const goto = (p: Place) => { setPlace(p); setDrawer(false); setOpenId(null); setReleased(false); setCursor(0); };

  const nav = (
    <nav className="rc__nav">
      {PLACES.map((p) => (
        <button
          key={p.id}
          type="button"
          className="rc__nav-item"
          aria-current={place === p.id}
          onClick={() => { goto(p.id); }}
        >
          <span className="rc__nav-glyph" aria-hidden>{p.glyph}</span>
          {p.label}
        </button>
      ))}
      <a className="rc__nav-item" href="/life-office">
        <span className="rc__nav-glyph" aria-hidden>🏢</span>
        사무실
      </a>
    </nav>
  );

  return (
    <main className="rc">
      <header className="rc__bar">
        <button type="button" className="rc__icon-btn rc__menu" onClick={() => { setDrawer(true); }} aria-label="메뉴">☰</button>
        <span className="rc__mark">Life OS</span>
        <div className="rc__searchwrap">
          <input
            ref={searchRef}
            className="rc__search"
            type="search"
            placeholder="지시 찾기"
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
          />
        </div>
        <span className="rc__me" aria-label="대표님">대</span>
      </header>

      {drawer && (
        <>
          <button type="button" className="rc__scrim" aria-label="닫기" onClick={() => { setDrawer(false); }} />
          <div className="rc__drawer">
            <p className="rc__drawer-mark">Life OS</p>
            {nav}
          </div>
        </>
      )}

      <div className="rc__body">
        <aside className="rc__rail">{nav}</aside>

        <section className="rc__panel">
          {open ? (
            <Reading work={open} busy={busy} onBack={() => { setOpenId(null); }} onDecide={decide} />
          ) : (
            <>
              {accepted && (
                <div className="rc__notice">
                  <h2>서비서 실장</h2>
                  <p>맡았습니다. 현재 적절한 팀에 배정하고 있습니다.</p>
                  <p className="rc__fine">대표님 판단이 필요한 때에 다시 올려드리겠습니다.</p>
                </div>
              )}

              {released && (
                <div className="rc__notice">
                  <h2>정해 주셔서 감사합니다.</h2>
                  <p className="rc__fine">닫으셔도 됩니다. 열어 두지 않아도 진행됩니다.</p>
                </div>
              )}

              {place === "inbox" && (
                listed.length === 0
                  ? <p className="rc__none">{q === "" ? "아직 올려드릴 보고가 없습니다." : "찾으시는 보고가 없습니다."}</p>
                  : listed.map((w, i) => (
                      <Row key={w.id} work={w} active={i === cursor} onOpen={() => { setOpenId(w.id); }} />
                    ))
              )}

              {place === "reports" && (
                listed.length === 0
                  ? <p className="rc__none">{q === "" ? "지난 보고가 아직 없습니다." : "찾으시는 보고가 없습니다."}</p>
                  : listed.map((w, i) => (
                      <Row key={w.id} work={w} active={i === cursor} onOpen={() => { setOpenId(w.id); }} />
                    ))
              )}

              {place === "outbox" && (
                sent.length === 0
                  ? <p className="rc__none">보내신 지시가 모두 마무리됐습니다.</p>
                  : sent.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="rc__row"
                        onClick={() => { setOpenId(o.id); setPlace("inbox"); }}
                      >
                        <span className="rc__sprite" aria-hidden>{o.assignee.name.slice(0, 1)}</span>
                        <span className="rc__row-main">
                          <span className="rc__row-top">
                            <span className="rc__who">{o.assignee.name}<span className="rc__title"> {o.assignee.title}</span></span>
                            <span className="rc__state">{STATE_LABEL[o.state] ?? o.state}</span>
                            <span className="rc__when">{when(o.acceptedAt)}</span>
                          </span>
                          <span className="rc__subject">{o.subject}</span>
                          <span className="rc__snippet">보낸 지시 · 접수 {when(o.acceptedAt)}</span>
                        </span>
                      </button>
                    ))
              )}

              {place === "calendar" && <p className="rc__none">지금 챙기실 약속은 없습니다.</p>}
            </>
          )}
        </section>
      </div>

      {!open && !composing && (
        <button type="button" className="rc__fab" onClick={() => { setComposing(true); setAccepted(false); }}>
          ✎ 업무 보내기
        </button>
      )}

      {composing && (
        <Compose
          busy={busy}
          refusals={refusals}
          onSend={send}
          onPhoto={sendPhoto}
          onClose={() => { setComposing(false); setRefusals([]); }}
        />
      )}
    </main>
  );
}

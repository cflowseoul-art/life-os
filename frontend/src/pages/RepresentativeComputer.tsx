/**
 * The Representative Computer.
 *
 * The approved model, in production: four places, an operational inbox, a
 * report reader that reads as a submitted document, and the office as a second
 * lens on the same work orders.
 *
 * Two rules the code holds to:
 *   - the inbox carries active work only; a finished report lives in 보고서
 *   - the representative sees one state vocabulary — 확인 필요 · 진행 중 · 완료
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
  workOrder?: { id: string; state: string; assignee: string; acceptedAt: string } | null;
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

type Desk = {
  employees?: Employee[];
  workOrders?: WorkOrder[];
  awaiting: Work[];
  inProgress: Work[];
  done: Work[];
};

type Place = "inbox" | "reports" | "outbox" | "calendar";

const PLACES: { id: Place; label: string; glyph: string }[] = [
  { id: "inbox", label: "받은 보고", glyph: "📥" },
  { id: "reports", label: "보고서", glyph: "📚" },
  { id: "outbox", label: "보낸 지시", glyph: "📤" },
  { id: "calendar", label: "일정", glyph: "📅" },
];

/** Desks, as the company describes them. The screen adds nothing. */
type Employee = {
  id: string;
  name: string;
  title: string;
  department: string;
  departmentLabel: string;
  floor: string;
  capability: string;
};

function stateOf(work: Work): string {
  if (work.section === "awaiting") return "확인 필요";
  if (work.section === "done") return "완료";
  return "진행 중";
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

function monthOf(work: Work): string {
  const at = work.history[work.history.length - 1]?.at ?? "";
  return at.slice(0, 7);
}

function naturalSource(text: string): string {
  return text
    .replace(/handover\.jdText:(\d+)/g, "보내주신 공고 $1번째 줄")
    .replace(/^공고 원문 (.+) 에서 확인한 요건입니다\.$/, "$1에서 확인했습니다");
}

function naturalRefusal(reason: string): string {
  if (reason.includes("회사") || reason.includes("직무")) {
    return "어느 회사, 어떤 자리인지까지 적어 주시면 바로 착수하겠습니다. (예: 토스 · 프로덕트 디자이너)";
  }
  if (reason.includes("본문")) return "공고 내용을 함께 주시면 그대로 읽고 정리하겠습니다.";
  return reason;
}

/** One report, one person. The name is the anchor. */
function Row({
  work,
  mark,
  onOpen,
}: {
  work: Work;
  mark?: "new" | null;
  onOpen: () => void;
}) {
  const needs = work.section === "awaiting";

  return (
    <button type="button" className={`row${needs ? " row--needs" : ""}`} onClick={onOpen}>
      <span className="sprite" aria-hidden>{work.contributor.slice(0, 1)}</span>

      <span className="row-main">
        <span className="who">
          {needs && <span className="dot" aria-label="확인 필요" />}
          {work.contributor}
          {work.contributorTitle && <span className="title"> {work.contributorTitle}</span>}
        </span>
        <span className="row-dept">{work.departmentLabel ?? ""}</span>
        <span className="subject">{work.title}</span>
        <span className="snippet">{work.report}</span>
      </span>

      <span>
        <span className={`stamp${mark === "new" ? " stamp--new" : ""}`}>
          {mark === "new" ? "NEW" : stateOf(work)}
        </span>
        <span className="when">{lastMoved(work)}</span>
      </span>
    </button>
  );
}

/** A document submitted by an employee, opened and closed by them. */
function Reader({
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
  const person = (
    <>
      {work.contributor}
      {work.contributorTitle && <span className="title"> {work.contributorTitle}</span>}
    </>
  );

  return (
    <article className="reader">
      <button type="button" className="back" onClick={onBack}>← 받은 보고</button>

      <div className="submitter">
        <span className="sprite" aria-hidden>{work.contributor.slice(0, 1)}</span>
        <div>
          <p className="submitter-name">{person}</p>
          <p className="submitter-dept">{work.departmentLabel}</p>
        </div>
        <p className="submitter-meta">
          {stateOf(work)}<br />{lastMoved(work)}
        </p>
      </div>

      <h1>{work.title}</h1>
      <p className="salute">보고드립니다.</p>

      <h2 className="h">요약</h2>
      <p className="lead">{work.report}</p>

      {(work.sections ?? []).map((sec) => (
        <div key={sec.heading}>
          <h2 className="h">{sec.heading}</h2>
          <ul className="bullets">
            {sec.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      ))}

      {work.attachment && (
        <div className="attach">
          <p className="attach-name">{work.attachment.name} · {work.attachment.lines}줄</p>
          <pre className="attach-pre">{work.attachment.preview.join("\n")}</pre>
        </div>
      )}

      {work.recommendation && (
        <>
          <h2 className="h">제안</h2>
          <p>{work.recommendation}</p>
        </>
      )}

      {work.ask && (
        <div className="decide">
          <h2 className="h">확인 필요</h2>
          <p>{work.decision ?? work.ask.question}</p>
          <div className="choices">
            {work.ask.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="choice"
                aria-pressed={choice === option.id}
                onClick={() => { setChoice(option.id); }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={choice === null || busy}
              onClick={() => { if (choice) onDecide(choice); }}
            >
              승인
            </button>
            {/* No revision event exists in the engine. Inert, not pretending. */}
            <button type="button" className="btn btn--ghost" disabled>수정 요청</button>
          </div>
        </div>
      )}

      {work.observations.length > 0 && (
        <details className="more">
          <summary>근거 · 출처 {work.observations.length}건</summary>
          <ul className="facts">
            {work.observations.map((o) => (
              <li key={o.id}>
                {o.statement}
                <span className="src">
                  {naturalSource(o.source)} · {when(o.acquiredAt)}에 확인
                  {o.confidence < 1 && " · 미루어 본 것"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="more">
        <summary>진행 과정</summary>
        <ul className="facts">
          {work.history.map((h, i) => (
            <li key={`${h.at}-${String(i)}`}>
              {h.what}
              <span className="src">{when(h.at)} · {h.actor}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="signoff">
        <p className="signoff-name">{person}</p>
        <p className="signoff-dept">{work.departmentLabel}</p>
        <p className="signoff-note">보고를 마칩니다.</p>
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

  return (
    <div className="compose" data-open="true">
      <div className="compose-bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        <span className="compose-title">업무 보내기</span>
        <button
          type="button"
          className="btn"
          disabled={busy || (text.trim() === "" && attachment.trim() === "")}
          onClick={() => {
            const [first, ...rest] = text.split("\n");
            onSend({ subject: first ?? "", request: rest.join("\n"), attachment });
          }}
        >
          보내기
        </button>
      </div>

      <div className="compose-body">
        <div className="to"><span>받는 곳</span><span>우리 회사 · 서비서 실장</span></div>

        <textarea
          className="write"
          rows={8}
          placeholder="무엇을 맡기시겠습니까? 평소 말씀하시듯 적어 주십시오."
          value={text}
          onChange={(e) => { setText(e.target.value); }}
        />

        <div className="attach-zone">
          <p className="attach-label">첨부</p>
          {/* OCR runs on the machine the server sits on; hosted deployments
              have none yet, and the refusal says so rather than failing. */}
          <input
            type="file"
            accept="image/*"
            className="file"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPhoto(file, text.split("\n")[0] ?? "");
            }}
          />
          <textarea
            className="attach-box"
            rows={6}
            placeholder="공고나 문서, 영수증 내용을 붙여 주십시오."
            value={attachment}
            onChange={(e) => { setAttachment(e.target.value); }}
          />
        </div>

        {refusals.length > 0 && (
          <ul className="refusals">
            {[...new Set(refusals.map(naturalRefusal))].map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

type Me =
  | { ok: true; user: { displayName: string; email: string }; household: { name: string; isOwner: boolean } }
  | { ok: false };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, options: Record<string, string>): void;
        };
      };
    };
  }
}

/**
 * The door.
 *
 * Google Identity Services hands us a credential; the server verifies it and
 * sets an httpOnly cookie. Nothing about the session is stored in the page, so
 * a refresh is answered by the server, not by local state.
 */
function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;

    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          fetch("/api/auth/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential }),
          })
            .then((r) => r.json() as Promise<{ ok: boolean; reason?: string }>)
            .then((result) => {
              if (result.ok) onSignedIn();
              else setError(result.reason ?? "로그인하지 못했습니다.");
            })
            .catch(() => { setError("로그인하지 못했습니다."); });
        },
      });

      if (holder.current) {
        window.google?.accounts.id.renderButton(holder.current, { theme: "outline", size: "large" });
      }
    };

    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [clientId, onSignedIn]);

  return (
    <main className="rc">
      <div className="signin">
        <span className="plate"><b>Life OS</b><span>대표님의 컴퓨터</span></span>
        <h1>대표님, 들어오십시오.</h1>
        <p>회사는 대표님 계정으로 움직입니다. 구글 계정으로 들어와 주십시오.</p>
        <div ref={holder} />
        {!clientId && <p className="empty">VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다.</p>}
        {error && <p className="empty">{error}</p>}
      </div>
    </main>
  );
}

export default function RepresentativeComputer() {
  const [me, setMe] = useState<Me | null>(null);
  const [desk, setDesk] = useState<Desk | null>(null);
  const [place, setPlace] = useState<Place>("inbox");
  const [lens, setLens] = useState<"list" | "office">("list");
  const [drawer, setDrawer] = useState(false);
  const [composing, setComposing] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<Me>)
      .then(setMe)
      .catch(() => { setMe({ ok: false }); });
  }, []);

  useEffect(loadMe, [loadMe]);

  // Which reports this person has already read. Per user, kept by the server
  // when it has somewhere to keep it.
  useEffect(() => {
    if (!me?.ok) return;

    fetch("/api/desk/read")
      .then((r) => r.json() as Promise<{ ok: boolean; holdIds?: string[] }>)
      .then((result) => { setRead(new Set(result.holdIds ?? [])); })
      .catch(() => undefined);
  }, [me]);

  useEffect(() => {
    if (!me?.ok) return;

    fetch("/api/desk")
      .then((r) => r.json() as Promise<Desk>)
      .then(setDesk)
      .catch(() => { setError("지금은 열어드리지 못했습니다. 잠시 후 다시 들어와 주십시오."); });
  }, [me]);

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
            setDesk(result.desk); setRefusals([]); setComposing(false); setAccepted(true);
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
          setDesk(result.desk); setRefusals([]); setComposing(false); setAccepted(true);
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
        if (result.ok && result.desk) { setDesk(result.desk); setOpenId(null); }
        else setError(result.reason ?? "정하신 것을 남기지 못했습니다. 다시 한 번 눌러 주십시오.");
      })
      .catch(() => { setError("정하신 것을 남기지 못했습니다. 다시 한 번 눌러 주십시오."); })
      .finally(() => { setBusy(false); });
  }, []);

  const all = useMemo(
    () => (desk ? [...desk.awaiting, ...desk.inProgress, ...desk.done] : []),
    [desk],
  );

  const open = all.find((w) => w.id === openId);

  const openWork = useCallback((work: Work) => {
    setOpenId(work.id);

    // Opening a finished report only clears its NEW mark. Nothing moves.
    if (work.section !== "done") return;

    setRead((r) => new Set(r).add(work.id));
    void fetch("/api/desk/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holdId: work.id }),
    }).catch(() => undefined);
  }, []);

  // j / k / Enter / Esc / 1–4 / O. Nothing destructive is bound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName ?? "";
      if (composing || tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") { setOpenId(null); setDrawer(false); return; }
      if (e.key === "o") { setLens((l) => (l === "office" ? "list" : "office")); setOpenId(null); return; }
      if (["1", "2", "3", "4"].includes(e.key)) {
        setPlace(PLACES[Number(e.key) - 1].id);
        setOpenId(null);
        setLens("list");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [composing]);

  if (me === null) return <main className="rc" />;
  if (!me.ok) return <SignIn onSignedIn={loadMe} />;
  if (error) return <main className="rc"><p className="empty">{error}</p></main>;
  if (!desk) return <main className="rc" />;

  const q = query.trim();
  const matches = (w: Work) => q === "" || `${w.title} ${w.contributor} ${w.report}`.includes(q);
  const orders = (desk.workOrders ?? []).filter((o) => o.state !== "completed" && o.state !== "withdrawn");

  const goto = (p: Place) => { setPlace(p); setLens("list"); setDrawer(false); setOpenId(null); };

  const nav = (
    <nav className="nav">
      {PLACES.map((p) => (
        <button
          key={p.id}
          type="button"
          className="nav-item"
          aria-current={place === p.id && lens === "list"}
          onClick={() => { goto(p.id); }}
        >
          <span className="nav-glyph" aria-hidden>{p.glyph}</span>
          {p.label}
        </button>
      ))}
    </nav>
  );

  const byMonth = new Map<string, Work[]>();
  for (const w of desk.done.filter(matches)) {
    byMonth.set(monthOf(w), [...(byMonth.get(monthOf(w)) ?? []), w]);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <main className="rc" data-drawer={drawer}>
      <header className="bar">
        <button type="button" className="icon-btn menu-btn" onClick={() => { setDrawer(true); }} aria-label="메뉴">☰</button>
        <span className="plate"><b>{me.household.name}</b><span>5F 대표실</span></span>
        <input
          className="search"
          type="search"
          placeholder="찾기"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
        />
        <div className="lens" role="group" aria-label="보기 전환">
          <button type="button" aria-pressed={lens === "list"} onClick={() => { setLens("list"); setOpenId(null); }}>목록</button>
          <button type="button" aria-pressed={lens === "office"} onClick={() => { setLens("office"); setOpenId(null); }}>사무실</button>
        </div>
        <button
          type="button"
          className="me"
          title={`${me.user.displayName} · ${me.user.email}`}
          onClick={() => {
            void fetch("/api/auth/signout", { method: "POST" }).then(() => { setMe({ ok: false }); });
          }}
        >
          {me.user.displayName.slice(0, 1)}
        </button>
      </header>

      {drawer && (
        <>
          <button type="button" className="scrim" aria-label="닫기" onClick={() => { setDrawer(false); }} />
          <div className="drawer">
            <p className="drawer-mark">Life OS</p>
            {nav}
          </div>
        </>
      )}

      <div className="shell">
        <aside className="rail">
          {nav}
          <p className="rail-note">Enter 열기 · Esc 닫기<br />1–4 자리 · O 사무실</p>
        </aside>

        <div className="panel">
          {open ? (
            <Reader work={open} busy={busy} onBack={() => { setOpenId(null); }} onDecide={decide} />
          ) : lens === "office" ? (
            <section>
              <div className="screen-head">
                <h1 className="screen-title">사무실</h1>
                <p className="screen-sub">같은 일을 자리로 본 것입니다. 목록과 같은 내용입니다.</p>
              </div>
              <p className="office-note">
                지금 5층에 올라와 있는 사람은 {desk.awaiting.length}명입니다 — 목록의 「확인 필요」와 같습니다.
              </p>

              {(() => {
                const staff = desk.employees ?? [];
                const floors = [...new Set(staff.map((e) => e.floor))].sort().reverse();
                // Position is read from the work order, never set by this screen.
                const upstairs = new Set(desk.awaiting.map((w) => w.contributor));
                const workOf = (name: string) =>
                  all.find((w) => w.contributor === name && w.section !== "done");

                return floors.map((floor) => (
                  <div key={floor} className={`floor${floor === "5F" ? " floor--top" : ""}`}>
                    <div className="floor-head">
                      <span className="floor-no">{floor}</span>
                      <span className="floor-teams">
                        {[...new Set(staff.filter((e) => e.floor === floor).map((e) => e.departmentLabel))].join(" · ")}
                      </span>
                    </div>
                    <div className="desks">
                      {staff
                        .filter((e) => (floor === "5F" ? e.floor === "5F" || upstairs.has(e.name) : e.floor === floor && !upstairs.has(e.name)))
                        .map((e) => {
                          const work = workOf(e.name);
                          const away = upstairs.has(e.name);

                          return (
                            <div key={`${floor}-${e.id}`} className={`desk${away ? " desk--away" : ""}`}>
                              <span className="sprite" aria-hidden>{e.name.slice(0, 1)}</span>
                              <div>
                                <p className="desk-name">{e.name}<span className="title"> {e.title}</span></p>
                                <p className="desk-dept">{e.departmentLabel}{away ? ` · ${e.floor}` : ""}</p>
                                <p className="desk-work">
                                  {work ? work.title : "맡고 있는 일이 없습니다."}
                                </p>
                                <span className="desk-tag">{away ? "보고 대기 중" : "자리에 있음"}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ));
              })()}
            </section>
          ) : (
            <section>
              {accepted && (
                <div className="office-note">
                  <b>서비서 실장</b> — 맡았습니다. 적절한 팀에 배정하고 있습니다.
                </div>
              )}

              {place === "inbox" && (
                <>
                  <div className="screen-head">
                    <h1 className="screen-title">대표님, 안녕하십니까.</h1>
                    <p className="screen-sub">
                      {desk.awaiting.length === 0
                        ? "오늘 확인하실 것은 없습니다."
                        : `오늘 확인하실 것은 ${String(desk.awaiting.length)}건입니다.`}
                    </p>
                  </div>

                  <p className="group-label">확인 필요</p>
                  {desk.awaiting.filter(matches).length === 0
                    ? <p className="empty">확인하실 보고가 없습니다.</p>
                    : desk.awaiting.filter(matches).map((w) => (
                        <Row key={w.id} work={w} onOpen={() => { openWork(w); }} />
                      ))}

                  <p className="group-label">업무 진행 현황</p>
                  {desk.inProgress.filter(matches).length === 0
                    ? <p className="empty">맡고 있는 일이 없습니다.</p>
                    : desk.inProgress.filter(matches).map((w) => (
                        <Row key={w.id} work={w} onOpen={() => { openWork(w); }} />
                      ))}
                </>
              )}

              {place === "reports" && (
                <>
                  <div className="screen-head">
                    <h1 className="screen-title">보고서</h1>
                    <p className="screen-sub">마무리된 보고는 곧바로 여기 쌓입니다. 최근 것은 위에 두었습니다.</p>
                  </div>
                  {months.length === 0
                    ? <p className="empty">아직 보고서가 없습니다.</p>
                    : months.map((m) => (
                        <div key={m}>
                          <p className="group-label">{m.replace("-", "년 ")}월</p>
                          {(byMonth.get(m) ?? []).map((w) => (
                            <Row
                              key={w.id}
                              work={w}
                              mark={read.has(w.id) ? null : "new"}
                              onOpen={() => { openWork(w); }}
                            />
                          ))}
                        </div>
                      ))}
                </>
              )}

              {place === "outbox" && (
                <>
                  <div className="screen-head">
                    <h1 className="screen-title">보낸 지시</h1>
                    <p className="screen-sub">회사가 맡고 있는 지시입니다. 여기서 하실 일은 없습니다.</p>
                  </div>
                  {orders.length === 0
                    ? <p className="empty">보내신 지시가 모두 마무리됐습니다.</p>
                    : orders.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="row"
                          onClick={() => { setOpenId(o.id); setPlace("inbox"); }}
                        >
                          <span className="sprite" aria-hidden>{o.assignee.name.slice(0, 1)}</span>
                          <span className="row-main">
                            <span className="who">{o.assignee.name}<span className="title"> {o.assignee.title}</span></span>
                            <span className="row-dept">{o.department}</span>
                            <span className="subject">{o.subject}</span>
                            <span className="snippet">접수 {when(o.acceptedAt)} · 회사가 맡고 있습니다</span>
                          </span>
                          <span>
                            <span className="stamp">진행 중</span>
                            <span className="when">{when(o.acceptedAt)}</span>
                          </span>
                        </button>
                      ))}
                </>
              )}

              {place === "calendar" && (
                <>
                  <div className="screen-head">
                    <h1 className="screen-title">일정</h1>
                    <p className="screen-sub">시간이 정해진 것만 둡니다.</p>
                  </div>
                  <p className="empty">지금 챙기실 약속은 없습니다.</p>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {!open && !composing && (
        <button type="button" className="fab" onClick={() => { setComposing(true); setAccepted(false); }}>
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

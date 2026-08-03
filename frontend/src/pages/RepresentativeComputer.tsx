/**
 * The Representative Computer — mobile inbox presentation.
 *
 * Presentation only. Data, decisions, and persistence still come from the
 * engine bridge (`/api/desk`, `/api/company/request`, `/api/desk/answer`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

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
  status: string;
  report: string;
  sections?: { heading: string; bullets: string[] }[];
  recommendation?: string;
  decision?: string | null;
  attachment?: { name: string; lines: number; preview: string[] } | null;
  project?: { id: string; name: string } | null;
  ask: Ask | null;
  artifact: Artifact | null;
  observations: Observation[];
  history: { at: string; actor: string; capability: string | null; what: string }[];
  withdrawnReason: string | null;
};

type Project = {
  id: string;
  owner: string;
  name: string;
  members: { holdId: string; title: string; state: "awaiting" | "inProgress" | "done" }[];
  reason: string;
  lifecycle: "active" | "dormant" | "closed";
};

type Desk = { projects?: Project[]; awaiting: Work[]; inProgress: Work[]; done: Work[] };

/** Departments as the representative would name them. */
const DEPARTMENT: Record<string, string> = {
  career: "커리어팀",
  finance: "재무팀",
  home: "살림팀",
  health: "건강팀",
  operations: "운영",
};

const LIFECYCLE: Record<Project["lifecycle"], string> = {
  active: "진행 중",
  dormant: "쉬는 중",
  closed: "마무리",
};

const ITEM_STATE: Record<Project["members"][number]["state"], string> = {
  awaiting: "결정 대기",
  inProgress: "진행 중",
  done: "완료",
};

type Place = "inbox" | "entrusted" | "past" | "schedule";

const PLACES: { id: Place; label: string }[] = [
  { id: "inbox", label: "업무 보고" },
  { id: "entrusted", label: "맡긴 일" },
  { id: "past", label: "지난 보고" },
  { id: "schedule", label: "일정" },
];

function when(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

/**
 * Provenance, said the way a person would say it. The record stores a pointer
 * (`handover.jdText:2`); nobody outside the code should ever read that.
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
  if (reason.includes("본문")) {
    return "공고 내용을 함께 주시면 그대로 읽고 정리하겠습니다.";
  }
  return reason;
}

function lastMoved(work: Work): string {
  return when(work.history[work.history.length - 1]?.at);
}

function Mail({ work, onOpen }: { work: Work; onOpen: () => void }) {
  const needs = work.section === "awaiting";

  return (
    <button
      type="button"
      className={`rc__mail${needs ? " rc__mail--flagged" : ""}`}
      onClick={onOpen}
    >
      <span className="rc__avatar">{work.contributor.slice(0, 1)}</span>
      <span className="rc__head">
        <span className="rc__name">{work.contributor}</span>
        <span className="rc__time">{lastMoved(work)}</span>
      </span>
      <span className="rc__subject-line">
        {needs && <span className="rc__dot" />}
        {work.title}
        {needs && <span className="rc__needs">결정 필요</span>}
      </span>
      <span className="rc__preview">{needs ? work.report : work.status}</span>
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
    <div className="rc__read">
      <button type="button" className="rc__icon-btn" onClick={onBack} aria-label="이전으로">←</button>

      <h1>{work.title}</h1>

      <div className="rc__from">
        <span className="rc__avatar">{work.contributor.slice(0, 1)}</span>
        <span>
          <span className="rc__name">{work.contributor}</span>
          <span className="rc__from-sub">{work.status}</span>
        </span>
        <span className="rc__time">{lastMoved(work)}</span>
      </div>

      <div className="rc__body">
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
            <p className="rc__attachment-name">
              {work.attachment.name} · {work.attachment.lines}줄
            </p>
            <pre className="rc__attachment-preview">{work.attachment.preview.join("\n")}</pre>
          </div>
        )}

        {work.recommendation && (
          <>
            <h2 className="rc__h">제안</h2>
            <p>{work.recommendation}</p>
          </>
        )}
      </div>

      {work.ask && (
        <div className="rc__decide">
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
        </div>
      )}

      {/* Collapsed by default: available to check, never in the way. */}
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
  );
}

function Compose({
  onSend,
  onClose,
  busy,
  refusals,
}: {
  onSend: (v: { subject: string; request: string; attachment: string }) => void;
  onClose: () => void;
  busy: boolean;
  refusals: string[];
}) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState("");

  const send = () => {
    // One natural-language field. The first line carries the subject the
    // bridge needs; nothing is asked of the representative beyond writing.
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
          <span>우리 회사</span>
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
  const [busy, setBusy] = useState(false);
  const [released, setReleased] = useState(false);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/desk")
      .then((r) => r.json() as Promise<Desk>)
      .then(setDesk)
      .catch(() => { setError("지금은 열어드리지 못했습니다. 잠시 후 다시 들어와 주십시오."); });
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

  if (error) return <main className="rc"><p className="rc__none">{error}</p></main>;
  if (!desk) return <main className="rc" />;

  const open = all.find((w) => w.id === openId);
  const firstRun = all.length === 0;
  const q = query.trim();
  const matches = (w: Work) => q === "" || `${w.title} ${w.contributor} ${w.report}`.includes(q);

  const inbox = [...desk.awaiting, ...desk.inProgress, ...desk.done].filter(matches);
  const entrusted = [...desk.awaiting, ...desk.inProgress].filter(matches);
  const past = desk.done.filter(matches);

  const goto = (p: Place) => { setPlace(p); setDrawer(false); setOpenId(null); setReleased(false); };

  return (
    <main className="rc">
      <div className="rc__bar">
        <button
          type="button"
          className="rc__icon-btn"
          onClick={() => { setDrawer(true); }}
          aria-label="메뉴"
        >
          ☰
        </button>
        <div className="rc__searchwrap">
          <input
            className="rc__search"
            type="search"
            placeholder="보고 찾기"
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
          />
        </div>
        <button type="button" className="rc__me" aria-label="Life OS">L</button>
      </div>

      {drawer && (
        <>
          <button type="button" className="rc__scrim" aria-label="닫기" onClick={() => { setDrawer(false); }} />
          <nav className="rc__drawer">
            <p className="rc__drawer-mark">Life OS</p>
            {PLACES.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rc__drawer-item"
                aria-current={place === p.id}
                onClick={() => { goto(p.id); }}
              >
                {p.label}
              </button>
            ))}
            <div className="rc__drawer-sep" />
            <a className="rc__drawer-item" href="/life-office">사무실 둘러보기</a>
          </nav>
        </>
      )}

      {open ? (
        <Reading
          work={open}
          busy={busy}
          onBack={() => { setOpenId(null); }}
          onDecide={decide}
        />
      ) : firstRun ? (
        <div className="rc__intro">
          <p className="rc__intro-lede">저희가 대표님 회사의 직원들입니다.</p>
          <p>맡기실 일을 평소 말씀하시듯 적어 주시면 됩니다. 나머지는 저희가 맡겠습니다.</p>
          <ul className="rc__intro-examples">
            <li>“이 공고 보고 이력서 좀 맞춰 줘”</li>
            <li>“우유 다 썼어. 다음에 장 볼 때 챙겨 줘”</li>
            <li>“이번 달에 자동으로 빠져나가는 것들 좀 정리해 줘”</li>
            <li>“다음 주에 검진 예약해야 하는데 일정이랑 안 겹치게 봐 줘”</li>
          </ul>
          <p className="rc__intro-bound">
            돈이 나가거나, 다른 사람에게 말이 전해지거나, 되돌릴 수 없는 일은 반드시 먼저
            여쭙고 진행하겠습니다.
          </p>
        </div>
      ) : (
        <div className="rc__list">
          {accepted && (
            <div className="rc__notice">
              <h2>김리서치</h2>
              <p>맡았습니다.</p>
              <p>현재 적절한 팀에 배정하고 있습니다.</p>
              <p className="rc__fine">대표님 판단이 필요한 때에 다시 올려드리겠습니다.</p>
            </div>
          )}

          {released && (
            <div className="rc__notice">
              <h2>정해 주셔서 감사합니다.</h2>
              <p>이어서 정리해서, 끝나면 지난 보고에 올려 두겠습니다.</p>
              <p className="rc__fine">닫으셔도 됩니다. 열어 두지 않아도 진행됩니다.</p>
            </div>
          )}

          {place === "inbox" && (
            inbox.length === 0
              ? <p className="rc__none">{q === "" ? "아직 올려드릴 보고가 없습니다." : "찾으시는 보고가 없습니다."}</p>
              : inbox.map((w) => <Mail key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />)
          )}

          {place === "entrusted" && (
            <>
              <p className="rc__label">지금 저희가 맡고 있는 일입니다.</p>

              {(desk.projects ?? []).map((p) => (
                <section className="rc__project" key={p.id}>
                  <h3 className="rc__project-name">{p.name}</h3>
                  <p className="rc__project-meta">
                    {DEPARTMENT[p.owner] ?? p.owner} · {LIFECYCLE[p.lifecycle]}
                  </p>
                  <ul className="rc__project-items">
                    {p.members.map((m) => (
                      <li key={m.holdId}>
                        <button
                          type="button"
                          className="rc__project-item"
                          onClick={() => { setOpenId(m.holdId); }}
                        >
                          <span>{m.title}</span>
                          <span className="rc__item-state">{ITEM_STATE[m.state]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {(() => {
                const loose = entrusted.filter((w) => !w.project);
                return loose.length === 0 && (desk.projects ?? []).length === 0
                  ? <p className="rc__none">지금 맡고 있는 일이 없습니다.</p>
                  : loose.map((w) => <Mail key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />);
              })()}
            </>
          )}

          {place === "past" && (
            past.length === 0
              ? <p className="rc__none">{q === "" ? "지난 보고가 아직 없습니다." : "찾으시는 보고가 없습니다."}</p>
              : past.map((w) => <Mail key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />)
          )}

          {place === "schedule" && (
            <p className="rc__none">지금 챙기실 약속은 없습니다.</p>
          )}
        </div>
      )}

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
          onClose={() => { setComposing(false); setRefusals([]); }}
        />
      )}
    </main>
  );
}

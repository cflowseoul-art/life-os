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
  ask: Ask | null;
  artifact: Artifact | null;
  observations: Observation[];
  history: { at: string; actor: string; capability: string | null; what: string }[];
  withdrawnReason: string | null;
};

type Desk = { awaiting: Work[]; inProgress: Work[]; done: Work[] };

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
      <button type="button" className="rc__icon-btn" onClick={onBack} aria-label="뒤로">←</button>

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
        <p>{work.report}</p>
      </div>

      {work.ask && (
        <div className="rc__block">
          <h2>결정</h2>
          <p>{work.ask.question}</p>
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

      {work.artifact && (
        <div className="rc__block">
          <h2>결과</h2>
          <p>{work.artifact.title}</p>
          <ul className="rc__facts">
            {work.artifact.sections.map((s) => (
              <li key={s.heading}>
                {s.heading}
                <span className="rc__src">{s.body}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rc__block">
        <h2>판단 근거</h2>
        <p>
          맡기신 원문에 적힌 내용만 그대로 옮겼고, 원문에 없는 내용은 채우지 않았습니다.
          무엇을 앞세울지는 대표님 판단으로 남겨 두었습니다.
        </p>
        <p>입력: 대표님이 보내신 요청과 첨부. 가정: 따로 강조하라고 하신 항목은 없습니다.</p>
      </div>

      <div className="rc__block">
        <h2>근거 · 출처</h2>
        {work.observations.length === 0 ? (
          <p>기록된 근거가 없습니다.</p>
        ) : (
          <ul className="rc__facts">
            {work.observations.map((o) => (
              <li key={o.id}>
                {o.statement}
                <span className="rc__src">
                  {o.source} · {when(o.acquiredAt)} 확인 · 확신도 {o.confidence}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rc__block">
        <h2>처리 이력</h2>
        <ul className="rc__facts">
          {work.history.map((h, i) => (
            <li key={`${h.at}-${String(i)}`}>
              {h.what}
              <span className="rc__src">{when(h.at)} · {h.actor}</span>
            </li>
          ))}
        </ul>
      </div>
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
          <span>AI Company</span>
        </div>

        <textarea
          className="rc__write"
          rows={8}
          placeholder="맡기실 일을 평소 말씀하시듯 적어 주세요."
          value={text}
          onChange={(e) => { setText(e.target.value); }}
        />

        <div className="rc__attach">
          <p className="rc__attach-label">첨부</p>
          <textarea
            className="rc__attach-box"
            rows={6}
            placeholder="공고나 문서를 붙여 넣으세요."
            value={attachment}
            onChange={(e) => { setAttachment(e.target.value); }}
          />
        </div>

        {refusals.length > 0 && (
          <ul className="rc__refusals">
            {refusals.map((r) => <li key={r}>{r}</li>)}
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
      .catch(() => { setError("컴퓨터를 열지 못했습니다."); });
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
          setRefusals(result.reasons ?? ["보내지 못했습니다."]);
        }
      })
      .catch(() => { setRefusals(["보내지 못했습니다."]); })
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
          setError(result.reason ?? "결정을 기록하지 못했습니다.");
        }
      })
      .catch(() => { setError("결정을 기록하지 못했습니다."); })
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
            placeholder="보고 검색"
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
          <p className="rc__intro-lede">저희가 대표님 밑에서 일합니다.</p>
          <p>맡기실 일을 평소 말씀하시듯 적어 주시면 됩니다.</p>
          <ul className="rc__intro-examples">
            <li>“이 공고 보고 이력서 좀 맞춰 줘”</li>
            <li>“우유 다 썼어. 다음에 장 볼 때 챙겨 줘”</li>
            <li>“이번 달에 자동으로 빠져나가는 것들 좀 정리해 줘”</li>
            <li>“다음 주에 검진 예약해야 하는데 일정이랑 안 겹치게 봐 줘”</li>
          </ul>
          <p className="rc__intro-bound">
            돈이 나가거나, 다른 사람에게 말이 전해지거나, 되돌릴 수 없는 일은 먼저 대표님께
            여쭙고 진행합니다.
          </p>
        </div>
      ) : (
        <div className="rc__list">
          {accepted && (
            <div className="rc__notice">
              <h2>김리서치</h2>
              <p>맡았습니다.</p>
              <p>현재 적절한 팀에 배정하고 있습니다.</p>
              <p className="rc__fine">대표님의 판단이 필요한 시점에 다시 보고드리겠습니다.</p>
            </div>
          )}

          {released && (
            <div className="rc__notice">
              <h2>정해 주셔서 감사합니다.</h2>
              <p>이어서 정리하고, 끝나면 지난 보고에 올려 두겠습니다.</p>
              <p className="rc__fine">닫으셔도 됩니다. 열어 두지 않아도 진행됩니다.</p>
            </div>
          )}

          {place === "inbox" && (
            inbox.length === 0
              ? <p className="rc__none">{q === "" ? "올라온 보고가 없습니다." : "찾으시는 보고가 없습니다."}</p>
              : inbox.map((w) => <Mail key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />)
          )}

          {place === "entrusted" && (
            <>
              <p className="rc__label">지금 회사가 맡고 있는 일입니다.</p>
              {entrusted.length === 0
                ? <p className="rc__none">맡긴 일이 없습니다.</p>
                : entrusted.map((w) => <Mail key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />)}
            </>
          )}

          {place === "past" && (
            past.length === 0
              ? <p className="rc__none">{q === "" ? "지난 보고가 없습니다." : "찾으시는 보고가 없습니다."}</p>
              : past.map((w) => <Mail key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />)
          )}

          {place === "schedule" && (
            <p className="rc__none">지금 알고 계셔야 할 약속은 없습니다.</p>
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

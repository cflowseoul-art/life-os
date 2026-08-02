/**
 * The Representative Computer — MVP.
 *
 * First run → work request → company reply → report → decision → completed.
 * Everything rendered comes from the engine bridge (`/api/desk`,
 * `/api/company/request`, `/api/desk/answer`). No engine logic lives here.
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

type Place = "report" | "schedule" | "projects" | "archive";

const PLACES: { id: Place; label: string }[] = [
  { id: "report", label: "업무 보고" },
  { id: "schedule", label: "일정" },
  { id: "projects", label: "프로젝트" },
  { id: "archive", label: "보고서" },
];

function when(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function lastMoved(work: Work): string {
  return when(work.history[work.history.length - 1]?.at);
}

/** The company introduces itself once, unsigned. Never shown again. */
function Introduction() {
  return (
    <section className="rc__intro">
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
    </section>
  );
}

function Compose({
  onSend,
  onCancel,
  busy,
  refusals,
}: {
  onSend: (v: { subject: string; request: string; attachment: string }) => void;
  onCancel: () => void;
  busy: boolean;
  refusals: string[];
}) {
  const [subject, setSubject] = useState("");
  const [request, setRequest] = useState("");
  const [attachment, setAttachment] = useState("");

  return (
    <section className="rc__compose">
      <button type="button" className="rc__back" onClick={onCancel}>← 업무 보고</button>

      <div className="rc__field">
        <label htmlFor="to">받는 곳</label>
        <p id="to" className="rc__fixed">AI Company</p>
      </div>

      <div className="rc__field">
        <label htmlFor="subject">제목</label>
        <input
          id="subject"
          className="rc__input"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); }}
        />
      </div>

      <div className="rc__field">
        <label htmlFor="request">요청</label>
        <textarea
          id="request"
          className="rc__input rc__textarea"
          rows={4}
          value={request}
          onChange={(e) => { setRequest(e.target.value); }}
        />
      </div>

      <div className="rc__field">
        <label htmlFor="attachment">첨부</label>
        <textarea
          id="attachment"
          className="rc__input rc__textarea"
          rows={6}
          value={attachment}
          onChange={(e) => { setAttachment(e.target.value); }}
        />
      </div>

      {refusals.length > 0 && (
        <ul className="rc__refusals">
          {refusals.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      <div className="rc__actions">
        <button
          type="button"
          className="rc__btn"
          disabled={busy || request.trim() === "" && attachment.trim() === ""}
          onClick={() => { onSend({ subject, request, attachment }); }}
        >
          보내기
        </button>
      </div>
    </section>
  );
}

/** The company replies once, signed, and promises only the next contact. */
function Accepted({ onBack }: { onBack: () => void }) {
  return (
    <section className="rc__released">
      <h3>김리서치</h3>
      <p>맡았습니다.</p>
      <p>현재 적절한 팀에 배정하고 있습니다.</p>
      <p>대표님의 판단이 필요한 시점에 다시 보고드리겠습니다.</p>
      <p style={{ marginTop: 24 }}>
        <button type="button" className="rc__btn rc__btn--ghost" onClick={onBack}>업무 보고로</button>
      </p>
    </section>
  );
}

function Row({ work, onOpen }: { work: Work; onOpen: () => void }) {
  return (
    <button type="button" className="rc__row" onClick={onOpen}>
      <span className="rc__row-who">{work.contributor}</span>
      <span className="rc__row-line">
        {work.title} <span className="rc__row-snippet">— {work.status}</span>
      </span>
      <span className="rc__row-when">{lastMoved(work)}</span>
    </button>
  );
}

function Detail({
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
    <>
      <button type="button" className="rc__back" onClick={onBack}>← 업무 보고</button>

      <p className="rc__who">담당 <b>{work.contributor}</b> · {work.status}</p>
      <h2 className="rc__title">{work.title}</h2>
      <p className="rc__lede">{work.report}</p>

      <hr className="rc__rule" />

      {work.ask && (
        <div className="rc__part">
          <h4>결정</h4>
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
        <div className="rc__part">
          <h4>결과</h4>
          <p>{work.artifact.title}</p>
          <ul className="rc__list">
            {work.artifact.sections.map((section) => (
              <li key={section.heading}>
                {section.heading}
                <span className="rc__source">{section.body}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rc__part">
        <h4>판단 근거</h4>
        <p>
          맡기신 원문에 적힌 내용만 그대로 옮겼고, 원문에 없는 내용은 채우지 않았습니다.
          무엇을 앞세울지는 대표님 판단으로 남겨 두었습니다.
        </p>
        <p>입력: 대표님이 보내신 요청과 첨부. 가정: 따로 강조하라고 하신 항목은 없습니다.</p>
      </div>

      <div className="rc__part">
        <h4>근거 · 출처</h4>
        {work.observations.length === 0 ? (
          <p>기록된 근거가 없습니다.</p>
        ) : (
          <ul className="rc__list">
            {work.observations.map((o) => (
              <li key={o.id}>
                {o.statement}
                <span className="rc__source">
                  {o.source} · {when(o.acquiredAt)} 확인 · 확신도 {o.confidence}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rc__part">
        <h4>처리 이력</h4>
        <ul className="rc__list">
          {work.history.map((h, i) => (
            <li key={`${h.at}-${String(i)}`}>
              {h.what}
              <span className="rc__source">{when(h.at)} · {h.actor}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function RepresentativeComputer() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [place, setPlace] = useState<Place>("report");
  const [view, setView] = useState<"stream" | "compose" | "accepted">("stream");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [released, setReleased] = useState(false);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);

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
          setView("accepted");
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
          setChoice(null);
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

  if (error) return <main className="rc"><p className="rc__main rc__empty">{error}</p></main>;
  if (!desk) return <main className="rc" />;

  const open = all.find((w) => w.id === openId);
  const decision = desk.awaiting[0] ?? null;
  const firstRun = all.length === 0;
  const today = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const backToStream = () => { setView("stream"); setOpenId(null); };

  return (
    <main className="rc">
      <header className="rc__top">
        <span className="rc__mark">Life OS</span>
        <span className="rc__today">{today}</span>
      </header>

      {!open && view === "stream" && !firstRun && (
        <nav className="rc__places">
          {PLACES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rc__place"
              aria-current={place === p.id}
              onClick={() => { setPlace(p.id); setReleased(false); }}
            >
              {p.label}
            </button>
          ))}
        </nav>
      )}

      <div className="rc__main">
        {open ? (
          <Detail work={open} busy={busy} onBack={backToStream} onDecide={decide} />
        ) : view === "compose" ? (
          <Compose onSend={send} onCancel={backToStream} busy={busy} refusals={refusals} />
        ) : view === "accepted" ? (
          <Accepted onBack={backToStream} />
        ) : place === "report" ? (
          <>
            {firstRun ? (
              <Introduction />
            ) : (
              <>
                <p className="rc__greeting">대표님</p>
                <p className="rc__sub">
                  {decision
                    ? "결정하실 것 하나, 나머지는 맡아 두었습니다."
                    : "지금 대표님께 올릴 것은 없습니다."}
                </p>
              </>
            )}

            <button type="button" className="rc__send" onClick={() => { setView("compose"); }}>
              ＋ 회사에 업무 보내기
            </button>

            {!firstRun && (
              <>
                <section className="rc__section">
                  {released && !decision && (
                    <div className="rc__released">
                      <h3>정해 주셔서 감사합니다.</h3>
                      <p>이어서 정리하고, 끝나면 보고서에 올려 두겠습니다.</p>
                      <p className="rc__fine">닫으셔도 됩니다. 열어 두지 않아도 진행됩니다.</p>
                    </div>
                  )}

                  {decision && (
                    <>
                      <p className="rc__group">결정 필요</p>
                      <article className="rc__decision">
                        <p className="rc__who">
                          담당 <b>{decision.contributor}</b>
                          <span className="rc__flag">결정 필요</span>
                        </p>
                        <h3 className="rc__subject">{decision.title}</h3>
                        <p className="rc__summary">{decision.report}</p>

                        {decision.ask && (
                          <>
                            <div className="rc__choices">
                              {decision.ask.options.map((option) => (
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
                                onClick={() => { if (choice) decide(choice); }}
                              >
                                승인
                              </button>
                              <button type="button" className="rc__btn rc__btn--ghost" disabled>
                                수정 요청
                              </button>
                              <button
                                type="button"
                                className="rc__link"
                                onClick={() => { setOpenId(decision.id); }}
                              >
                                근거 보기
                              </button>
                            </div>
                          </>
                        )}
                      </article>
                    </>
                  )}
                </section>

                <section className="rc__section">
                  <p className="rc__group">맡아 둔 것</p>
                  {desk.inProgress.length === 0 ? (
                    <p className="rc__empty">맡아 둔 일이 없습니다.</p>
                  ) : (
                    <div className="rc__rows">
                      {desk.inProgress.map((w) => (
                        <Row key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="rc__section">
                  <p className="rc__group">끝난 것</p>
                  {desk.done.length === 0 ? (
                    <p className="rc__empty">아직 마무리된 일이 없습니다.</p>
                  ) : (
                    <div className="rc__rows">
                      {desk.done.map((w) => (
                        <Row key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />
                      ))}
                    </div>
                  )}
                </section>

                <aside className="rc__office">
                  <h3>직원들이 근무 중입니다.</h3>
                  <p>대표님이 가셔야 할 이유는 없습니다.</p>
                  <a className="rc__walk" href="/life-office">사무실 둘러보기</a>
                </aside>
              </>
            )}
          </>
        ) : place === "projects" ? (
          <>
            <p className="rc__greeting">맡겨 두신 것들</p>
            <p className="rc__sub">지금 보관 중인 일입니다. 여기서 하실 일은 없습니다.</p>
            {desk.awaiting.length + desk.inProgress.length === 0 ? (
              <p className="rc__empty">보관 중인 일이 없습니다.</p>
            ) : (
              <ul className="rc__entrusted">
                {[...desk.awaiting, ...desk.inProgress].map((w) => (
                  <li key={w.id}>
                    <h4>{w.title}</h4>
                    <p className="rc__meta">{w.contributor} · {when(w.history[0]?.at)}부터</p>
                    <p className="rc__state">{w.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : place === "archive" ? (
          <>
            <p className="rc__greeting">보고서</p>
            <p className="rc__sub">끝난 일은 그대로 남습니다. 언제든 되짚어 보실 수 있습니다.</p>
            <input
              className="rc__search"
              type="search"
              placeholder="보고서 검색"
              value={query}
              onChange={(e) => { setQuery(e.target.value); }}
            />
            {(() => {
              const found = desk.done.filter(
                (w) =>
                  query.trim() === ""
                  || `${w.title} ${w.contributor} ${w.report}`.includes(query.trim()),
              );

              return found.length === 0 ? (
                <p className="rc__empty">
                  {query.trim() === "" ? "아직 남은 보고서가 없습니다." : "찾으시는 보고서가 없습니다."}
                </p>
              ) : (
                <div className="rc__rows">
                  {found.map((w) => (
                    <Row key={w.id} work={w} onOpen={() => { setOpenId(w.id); }} />
                  ))}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <p className="rc__greeting">일정</p>
            <p className="rc__sub">시간이 정해진 것만 둡니다.</p>
            <p className="rc__empty">지금 알고 계셔야 할 약속은 없습니다.</p>
          </>
        )}
      </div>
    </main>
  );
}

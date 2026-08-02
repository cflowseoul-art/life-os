/**
 * Life Office — control tower demo page (frontend only).
 *
 * Everything on this page is mocked: the workflow is a fixture list, the events
 * are produced by setTimeout, and the approval gate resolves in memory. No API
 * call, no file write, no command execution, no AI call happens here.
 */

import "../components/life-office/life-office.css";

import { useState } from "react";

import { ApprovalPanel } from "../components/life-office/ApprovalPanel";
import { EventLog } from "../components/life-office/EventLog";
import { OfficeGame } from "../components/life-office/game/OfficeGame";
import { useWorkflowBridge } from "../components/life-office/adapter/workflowBridge";
import { StageList } from "../components/life-office/StageList";
import { useWorkflowEngine } from "../components/life-office/useWorkflowEngine";
import {
  CAREER_TEAM,
  EMPTY_JOB_CONTEXT,
  isJobContextValid,
} from "../components/life-office/workflow";
import type { JobContext } from "../components/life-office/types";

const STATUS_LABEL: Record<string, string> = {
  idle: "대기 중",
  running: "진행 중",
  awaiting_approval: "승인 대기",
  completed: "완료",
  stopped: "중단됨",
};

export default function LifeOfficeDemo() {
  const { state, start, approve, reject, reset } = useWorkflowEngine();

  // Draft input lives in the page; it only becomes workflow state on start.
  const [draft, setDraft] = useState<JobContext>(EMPTY_JOB_CONTEXT);

  // Single writer: workflow state -> gameStore -> Pixi scene.
  useWorkflowBridge(state);

  const running = state.status === "running" || state.status === "awaiting_approval";
  const canStart = isJobContextValid(draft) && !running;

  const patch = (field: keyof JobContext) => (value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="lo-root">
      <header className="lo-header">
        <div>
          <h1 className="lo-title">🏢 Life Office — 커리어팀 관제탑</h1>
          <p className="lo-subtitle">
            직원 {CAREER_TEAM.length}명 · 상태: {STATUS_LABEL[state.status]} · 모의
            데이터 전용 (실제 실행 없음)
          </p>
          <p className="lo-subtitle">
            {isJobContextValid(state.jobContext)
              ? `대상 공고: ${state.jobContext.company} · ${state.jobContext.role}`
              : "대상 공고: 미지정 — 회사·직무·JD 입력 후 시작"}
          </p>
        </div>

        <div className="lo-spacer" />

        <button
          type="button"
          className="lo-btn lo-btn-primary"
          onClick={() => start(draft)}
          disabled={!canStart}
        >
          워크플로 시작
        </button>

        <button type="button" className="lo-btn" onClick={reset}>
          초기화
        </button>
      </header>

      <section className="lo-panel" aria-label="공고 입력">
        <p className="lo-panel-title">공고 입력</p>

        <div className="lo-job-inputs">
          <label className="lo-field">
            <span>회사</span>
            <input
              type="text"
              value={draft.company}
              onChange={(e) => patch("company")(e.target.value)}
              disabled={running}
              placeholder="예: 원프레딕트"
            />
          </label>

          <label className="lo-field">
            <span>직무</span>
            <input
              type="text"
              value={draft.role}
              onChange={(e) => patch("role")(e.target.value)}
              disabled={running}
              placeholder="예: 데이터 분석가"
            />
          </label>
        </div>

        <label className="lo-field">
          <span>채용공고 본문 (JD)</span>
          <textarea
            rows={5}
            value={draft.jdText}
            onChange={(e) => patch("jdText")(e.target.value)}
            disabled={running}
            placeholder="공고 본문을 붙여넣으세요. 지금은 저장만 하고 분석하지 않습니다."
          />
        </label>

        <div className="lo-note">
          {canStart
            ? "입력 완료 — 워크플로를 시작할 수 있습니다."
            : "회사·직무·JD를 모두 입력해야 워크플로가 시작됩니다. 지원서 발송은 여전히 직접 하셔야 합니다."}
        </div>
      </section>

      {state.approval && (
        <ApprovalPanel request={state.approval} onApprove={approve} onReject={reject} />
      )}

      {state.status === "stopped" && (
        <section className="lo-stopped" aria-label="중단 상태">
          <strong>🛑 워크플로 중단됨</strong>
          <div className="lo-note" style={{ marginTop: 6 }}>
            {state.stopReason} 이후 단계는 실행되지 않았습니다. 다시 진행하려면
            초기화 후 시작하세요.
          </div>
        </section>
      )}

      <div className="lo-grid">
        <div className="lo-panel">
          <p className="lo-panel-title">사무실 평면도</p>
          <div className="lo-floor-scroll">
            <OfficeGame />
          </div>
        </div>

        <div>
          <div className="lo-panel" style={{ marginBottom: 16 }}>
            <p className="lo-panel-title">순차 워크플로</p>
            <StageList state={state} />
          </div>

          <div className="lo-panel">
            <p className="lo-panel-title">이벤트 로그 (모의)</p>
            <EventLog entries={state.log} />
          </div>
        </div>
      </div>
    </div>
  );
}

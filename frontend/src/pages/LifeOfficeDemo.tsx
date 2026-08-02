/**
 * Life Office — full-screen Office shell.
 *
 * The Pixi office is the permanent background layer; every control floats
 * above it. Mobile portrait is the primary layout (top bar, tab bar, FAB,
 * bottom sheet); desktop shows the same office with left/right overlays.
 *
 * Workflow state is still the existing mocked reducer. A real backend run,
 * when present, takes over progression and suspends the scripted timer.
 */

import "../components/life-office/life-office.css";

import { useEffect, useRef, useState } from "react";

import {
  getResumeRun,
  isRunActive,
  startResumeRun,
  type ResumeRun,
} from "../api/resume-api";

import { ApprovalPanel } from "../components/life-office/ApprovalPanel";
import { EventLog } from "../components/life-office/EventLog";
import { OfficeGame } from "../components/life-office/game/OfficeGame";
import { useWorkflowBridge } from "../components/life-office/adapter/workflowBridge";
import { StageList } from "../components/life-office/StageList";
import { useWorkflowEngine } from "../components/life-office/useWorkflowEngine";
import { useResumeProgress } from "../components/life-office/useResumeProgress";
import {
  applyPreset,
  CAMERA_PRESETS,
  DEFAULT_MOBILE_PRESET,
  onCameraMovedByUser,
} from "../components/life-office/adapter/camera-presets";
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
  // A backend run takes over progression; the mocked timer only runs when
  // there is no real run to follow.
  const [run, setRun] = useState<ResumeRun | null>(null);
  const { state, send, start, approve, reject, reset } =
    useWorkflowEngine(run === null);

  useResumeProgress(run, send);

  // Draft input lives in the page; it only becomes workflow state on start,
  // and closing the bottom sheet never discards it.
  const [draft, setDraft] = useState<JobContext>(EMPTY_JOB_CONTEXT);

  // Single writer: workflow state -> gameStore -> Pixi scene.
  useWorkflowBridge(state);

  const [runError, setRunError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  // Poll while queued/running; stop on completed or failed.
  useEffect(() => {
    if (!run || !isRunActive(run.status)) {
      return;
    }

    const runId = run.id;
    let cancelled = false;

    const timer = window.setInterval(() => {
      void getResumeRun(runId)
        .then((next) => {
          if (!cancelled) {
            setRun(next);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setRunError(
              error instanceof Error ? error.message : String(error),
            );
          }
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [run]);

  const startRun = () => {
    // Existing JD validation still gates the mocked workflow AND the API call.
    start(draft);
    setRunError(null);

    void startResumeRun(draft)
      .then((started) => {
        runIdRef.current = started.id;
        setRun(started);
      })
      .catch((error: unknown) => {
        setRunError(
          error instanceof Error ? error.message : String(error),
        );
      });
  };

  const running =
    state.status === "running" || state.status === "awaiting_approval";
  const canStart = isJobContextValid(draft) && !running;

  const patch = (field: keyof JobContext) => (value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const [tab, setTab] = useState<"office" | "progress" | "result">("office");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(
    DEFAULT_MOBILE_PRESET,
  );

  // A manual pan or pinch drops the highlight; tapping a chip restores it.
  useEffect(() => {
    onCameraMovedByUser(() => {
      setActivePreset(null);
    });

    return () => {
      onCameraMovedByUser(null);
    };
  }, []);

  // Mobile opens on the Career team; desktop keeps the wrapper's own default.
  useEffect(() => {
    if (window.innerWidth >= 900) {
      setActivePreset(null);
      return;
    }

    const preset = CAMERA_PRESETS.find(
      (item) => item.id === DEFAULT_MOBILE_PRESET,
    );

    if (!preset) {
      return;
    }

    // Let the Pixi stage mount before moving the camera.
    const timer = window.setTimeout(() => {
      applyPreset(preset);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const startAndClose = () => {
    startRun();
    setSheetOpen(false);
  };

  const jobLine = isJobContextValid(state.jobContext)
    ? `${state.jobContext.company} · ${state.jobContext.role}`
    : "공고 미지정";

  const runLine = run ? `${run.runner} · ${run.status}` : "실행 없음";

  const inputs = (
    <>
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
          rows={6}
          value={draft.jdText}
          onChange={(e) => patch("jdText")(e.target.value)}
          disabled={running}
          placeholder="공고 본문을 붙여넣으세요."
        />
      </label>

      <div className="lo-note" style={{ margin: "10px 0" }}>
        {canStart
          ? "입력 완료 — 워크플로를 시작할 수 있습니다."
          : "회사·직무·JD를 모두 입력해야 시작됩니다."}
      </div>

      <button
        type="button"
        className="lo-btn lo-btn-primary"
        onClick={startAndClose}
        disabled={!canStart}
      >
        워크플로 시작
      </button>

      <button
        type="button"
        className="lo-btn"
        onClick={reset}
        style={{ marginTop: 8 }}
      >
        초기화
      </button>
    </>
  );

  const progress = (
    <>
      <p className="lo-panel-title">실행 상태</p>
      <div className="lo-note">
        {runLine}
        {run?.outputDir && <span className="lo-path">{run.outputDir}</span>}
      </div>
      {(runError ?? run?.error) && (
        <div className="lo-note" style={{ marginTop: 6 }}>
          ⚠️ {runError ?? run?.error}
        </div>
      )}

      {state.approval && (
        <div style={{ marginTop: 12 }}>
          <ApprovalPanel
            request={state.approval}
            onApprove={approve}
            onReject={reject}
          />
        </div>
      )}

      {state.status === "stopped" && (
        <section className="lo-stopped" style={{ marginTop: 12 }}>
          <strong>🛑 워크플로 중단됨</strong>
          <div className="lo-note" style={{ marginTop: 6 }}>
            {state.stopReason}
          </div>
        </section>
      )}

      <p className="lo-panel-title" style={{ marginTop: 16 }}>
        순차 워크플로
      </p>
      <StageList state={state} />

      <p className="lo-panel-title" style={{ marginTop: 16 }}>
        이벤트 로그
      </p>
      <EventLog entries={state.log} />
    </>
  );

  const result = (
    <>
      <p className="lo-panel-title">결과</p>
      <div className="lo-note">
        {run?.status === "completed"
          ? `산출물 ${String(run.artifacts.length)}건 · ${run.outputDir ?? ""}`
          : `아직 결과가 없습니다. (${runLine})`}
      </div>
      <div className="lo-note" style={{ marginTop: 8 }}>
        문서 보기와 PDF는 아직 준비 중입니다.
      </div>
    </>
  );

  return (
    <div className="lo-shell">
      {/* Office is the permanent full-screen background layer. */}
      <div className="lo-stage-layer">
        <OfficeGame />
      </div>

      <header className="lo-topbar">
        <div>
          <p className="lo-topbar-title">🏢 Life Office — 커리어팀</p>
          <p className="lo-topbar-sub">
            {STATUS_LABEL[state.status]} · {jobLine} · 직원{" "}
            {CAREER_TEAM.length}명
          </p>
        </div>
      </header>

      {/* Desktop overlays: inputs left, runtime right. */}
      <section className="lo-overlay lo-panel-left lo-desktop-only">
        <div className="lo-overlay-scroll">{inputs}</div>
      </section>

      <section className="lo-overlay lo-panel-right lo-desktop-only">
        <div className="lo-overlay-scroll">
          {progress}
          <div style={{ marginTop: 16 }}>{result}</div>
        </div>
      </section>

      {/* Mobile tab panels. 사무실 leaves the Office unobstructed. */}
      {tab === "progress" && (
        <section className="lo-overlay lo-panel-mobile lo-mobile-only">
          <div className="lo-overlay-scroll">{progress}</div>
        </section>
      )}

      {tab === "result" && (
        <section className="lo-overlay lo-panel-mobile lo-mobile-only">
          <div className="lo-overlay-scroll">{result}</div>
        </section>
      )}

      <button
        type="button"
        className="lo-fab"
        onClick={() => setSheetOpen(true)}
      >
        + 새 작업
      </button>

      <nav className="lo-navigator" aria-label="오피스 이동">
        {CAMERA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="lo-nav-chip"
            aria-pressed={activePreset === preset.id}
            disabled={preset.disabled}
            onClick={() => {
              applyPreset(preset);
              setActivePreset(preset.id);
            }}
          >
            {preset.label}
          </button>
        ))}
      </nav>

      <nav className="lo-tabbar" role="tablist">
        <button
          type="button"
          role="tab"
          className="lo-tab"
          aria-selected={tab === "office"}
          onClick={() => setTab("office")}
        >
          사무실
        </button>
        <button
          type="button"
          role="tab"
          className="lo-tab"
          aria-selected={tab === "progress"}
          onClick={() => setTab("progress")}
        >
          진행
        </button>
        <button
          type="button"
          role="tab"
          className="lo-tab"
          aria-selected={tab === "result"}
          onClick={() => setTab("result")}
        >
          결과
        </button>
      </nav>

      {sheetOpen && (
        <>
          <div
            className="lo-sheet-backdrop"
            onClick={() => setSheetOpen(false)}
          />
          <div className="lo-sheet" role="dialog" aria-label="새 작업">
            <div className="lo-sheet-head">
              <strong style={{ flex: 1 }}>새 작업</strong>
              <button
                type="button"
                className="lo-btn"
                onClick={() => setSheetOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="lo-sheet-body">{inputs}</div>
          </div>
        </>
      )}
    </div>
  );
}

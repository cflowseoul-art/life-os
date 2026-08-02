/** Approval gate for the stage that raised `approval_required`. */

import type { ApprovalRequest } from "./types";

type Props = {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalPanel({ request, onApprove, onReject }: Props) {
  return (
    <section className="lo-approval" aria-label="승인 요청">
      <div className="lo-approval-head">⏸ 승인 대기 — 워크플로가 멈췄습니다</div>

      <div className="lo-approval-body">
        <div>
          <div className="lo-field">
            <div className="lo-field-label">요청 작업</div>
            <div className="lo-field-value">{request.action}</div>
          </div>

          <div className="lo-field">
            <div className="lo-field-label">승인이 필요한 이유</div>
            <div className="lo-field-value">{request.reason}</div>
          </div>

          <div className="lo-approval-actions">
            <button
              type="button"
              className="lo-btn lo-btn-approve"
              onClick={onApprove}
            >
              승인
            </button>

            <button
              type="button"
              className="lo-btn lo-btn-reject"
              onClick={onReject}
            >
              반려
            </button>
          </div>
        </div>

        <div>
          <div className="lo-field-label">제안된 커맨드 (실행되지 않음)</div>
          <pre className="lo-payload">{request.payload.join("\n")}</pre>

          <p className="lo-note">
            승인하면 다음 단계로 진행하고, 반려하면 워크플로가 중단 상태로 남습니다.
            어느 쪽이든 실제 메일 발송이나 파일 변경은 일어나지 않습니다.
          </p>
        </div>
      </div>
    </section>
  );
}

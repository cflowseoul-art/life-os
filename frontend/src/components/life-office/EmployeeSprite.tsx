/**
 * Renders one employee. Takes semantic activity (for the label) and visual
 * sprite state (for the position) as two separate props on purpose.
 */

import type { Employee, EmployeeActivity } from "./types";
import type { SpriteState } from "./useOfficeAnimation";

/** Shirt / hair colours per employee so they stay tellable apart. */
const PALETTE: Record<string, { shirt: string; hair: string }> = {
  research: { shirt: "#6ea8ff", hair: "#2b2f45" },
  analysis: { shirt: "#4ecf9a", hair: "#4a3527" },
  draft: { shirt: "#ffc35c", hair: "#2b2f45" },
  review: { shirt: "#d4a5ff", hair: "#3a2a4d" },
  outreach: { shirt: "#ff8fa3", hair: "#4a3527" },
  manager: { shirt: "#9fb4d8", hair: "#20242f" },
};

const SKIN = "#f0c49a";
const PANTS = "#2c3444";

/** A 12x16 pixel-grid person. Plain rects, no external assets. */
function PixelPerson({ id }: { id: string }) {
  const { shirt, hair } = PALETTE[id] ?? PALETTE.manager;

  return (
    <svg className="lo-pixel" viewBox="0 0 12 16" aria-hidden="true">
      <rect x="3" y="1" width="6" height="2" fill={hair} />
      <rect x="3" y="3" width="6" height="4" fill={SKIN} />
      <rect x="3" y="3" width="1" height="2" fill={hair} />
      <rect x="8" y="3" width="1" height="2" fill={hair} />
      <rect x="4" y="4" width="1" height="1" fill="#22252f" />
      <rect x="7" y="4" width="1" height="1" fill="#22252f" />
      <rect x="5" y="7" width="2" height="1" fill={SKIN} />
      <rect x="3" y="8" width="6" height="4" fill={shirt} />
      <rect x="2" y="8" width="1" height="4" fill={shirt} />
      <rect x="9" y="8" width="1" height="4" fill={shirt} />
      <rect x="2" y="12" width="1" height="1" fill={SKIN} />
      <rect x="9" y="12" width="1" height="1" fill={SKIN} />
      <rect x="4" y="12" width="2" height="3" fill={PANTS} />
      <rect x="6" y="12" width="2" height="3" fill={PANTS} />
      <rect x="4" y="15" width="2" height="1" fill="#171b26" />
      <rect x="6" y="15" width="2" height="1" fill="#171b26" />
    </svg>
  );
}

const ACTIVITY_LABEL: Record<EmployeeActivity, string> = {
  waiting: "대기",
  walking: "이동 중",
  working: "작업 중",
  reviewing: "검토 중",
  done: "완료",
  stopped: "중단",
};

type Props = {
  employee: Employee;
  activity: EmployeeActivity;
  sprite: SpriteState;
};

export function EmployeeSprite({ employee, activity, sprite }: Props) {
  const classes = [
    "lo-sprite",
    `lo-anim-${activity}`,
    sprite.facing === "left" ? "lo-sprite-flip" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ left: `${sprite.position.x}%`, top: `${sprite.position.y}%` }}
    >
      <div className="lo-sprite-body">
        <span className="lo-sprite-face">
          <PixelPerson id={employee.id} />
        </span>
      </div>

      <div className="lo-sprite-name">{employee.name}</div>
      <div className="lo-sprite-role">{employee.role}</div>

      <div className={`lo-badge lo-badge-${activity}`}>
        {ACTIVITY_LABEL[activity]}
      </div>
    </div>
  );
}

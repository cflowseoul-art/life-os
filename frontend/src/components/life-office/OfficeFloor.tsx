/** The office floor: desks, zones, sprites and the final report bubble. */

import { useEffect, useRef } from "react";

import { EmployeeSprite } from "./EmployeeSprite";
import {
  BUBBLE_OFFSET_PX,
  COFFEE_ZONE,
  DESKS,
  ENTRANCE,
  PATH_H_Y,
  PATH_V_X,
  REPORT_ZONE,
  WORK_ZONE,
  ZONE_LABEL_OFFSET_PX,
} from "./layout";
import { CAREER_TEAM, STAGES } from "./workflow";
import type { WorkflowState } from "./types";
import type { SpriteMap } from "./useOfficeAnimation";

type Props = {
  state: WorkflowState;
  sprites: SpriteMap;
};

export function OfficeFloor({ state, sprites }: Props) {
  const activeStage = STAGES[state.activeStageIndex];
  const workActive = activeStage?.zone === "work";
  const reportActive = activeStage?.zone === "report" || state.report !== null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);

  // On narrow screens the floor scrolls inside its own box; keep whoever is
  // currently acting inside the visible slice. Purely a viewport concern.
  const focusX = activeStage
    ? sprites[activeStage.assignee].position.x
    : state.report !== null
      ? REPORT_ZONE.x
      : null;

  useEffect(() => {
    const box = scrollRef.current;
    const floor = floorRef.current;

    if (!box || !floor || focusX === null) {
      return;
    }

    if (floor.clientWidth <= box.clientWidth) {
      return;
    }

    const target = (focusX / 100) * floor.clientWidth - box.clientWidth / 2;

    box.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [focusX]);

  return (
    <div className="lo-floor-scroll" ref={scrollRef}>
      <div className="lo-floor" ref={floorRef}>
        {/* --- static scenery: wall, corridors, stations --- */}
        <div className="lo-wall">
          <span className="lo-window" />
          <span className="lo-window" />
          <span className="lo-window" />
          <span className="lo-wall-clock" />
        </div>

        <div className="lo-path lo-path-h" style={{ top: `${PATH_H_Y}%` }} />
        <div className="lo-path lo-path-v" style={{ left: `${PATH_V_X}%` }} />

        <div
          className="lo-entrance"
          style={{ left: `${ENTRANCE.x}%`, top: `${ENTRANCE.y}%` }}
        >
          <span className="lo-door" />
          <span className="lo-tag">입구</span>
        </div>

        <div
          className="lo-meeting-table"
          style={{ left: `${WORK_ZONE.x}%`, top: `${WORK_ZONE.y}%` }}
        />

        <div
          className="lo-coffee"
          style={{ left: `${COFFEE_ZONE.x}%`, top: `${COFFEE_ZONE.y}%` }}
        >
          <span className="lo-machine" />
          <span className="lo-tag">커피</span>
        </div>

        <div
          className="lo-report-platform"
          style={{ left: `${REPORT_ZONE.x}%`, top: `${REPORT_ZONE.y}%` }}
        />

        {/* Workstation cards sit exactly under each home position. */}
      {CAREER_TEAM.map((employee) => (
        <div
          key={`desk-${employee.id}`}
          className="lo-desk"
          style={{
            left: `${DESKS[employee.id].x}%`,
            top: `${DESKS[employee.id].y}%`,
          }}
        />
      ))}

      <div
        className={`lo-zone ${workActive ? "lo-zone-active" : ""}`}
        style={{
          left: `${WORK_ZONE.x}%`,
          top: `calc(${WORK_ZONE.y}% + ${ZONE_LABEL_OFFSET_PX}px)`,
        }}
      >
        <div className="lo-zone-label">🗂 작업 구역</div>
        <div>{activeStage && workActive ? activeStage.title : "대기"}</div>
      </div>

      <div
        className={`lo-zone ${reportActive ? "lo-zone-active" : ""}`}
        style={{
          left: `${REPORT_ZONE.x}%`,
          top: `calc(${REPORT_ZONE.y}% + ${ZONE_LABEL_OFFSET_PX}px)`,
        }}
      >
        <div className="lo-zone-label">📋 보고 구역</div>
        <div>대표 보고 라인</div>
      </div>

      {state.report && (
        <div
          className="lo-report-bubble"
          style={{
            left: `${REPORT_ZONE.x}%`,
            top: `calc(${REPORT_ZONE.y}% - ${BUBBLE_OFFSET_PX}px)`,
          }}
          role="status"
        >
          {state.report}
        </div>
      )}

        {CAREER_TEAM.map((employee) => (
          <EmployeeSprite
            key={employee.id}
            employee={employee}
            activity={state.employees[employee.id]}
            sprite={sprites[employee.id]}
          />
        ))}
      </div>
    </div>
  );
}

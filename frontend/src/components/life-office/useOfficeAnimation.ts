/**
 * Life Office — VISUAL state derived from semantic workflow state.
 *
 * The workflow reducer knows nothing about this file. Here we translate
 * "who is doing what" into "where the sprite should be and which way it faces".
 * CSS transitions handle the in-between frames.
 */

import { useEffect, useState } from "react";

import { DESKS, REPORT_ZONE, WORK_ZONE, type Point } from "./layout";
import { CAREER_TEAM, STAGES } from "./workflow";
import type { EmployeeId, WorkflowState } from "./types";

export type SpriteState = {
  position: Point;
  facing: "left" | "right";
  /** True while a walk transition should be running. */
  moving: boolean;
};

export type SpriteMap = Record<EmployeeId, SpriteState>;

function initialSprites(): SpriteMap {
  const sprites = {} as SpriteMap;

  for (const employee of CAREER_TEAM) {
    sprites[employee.id] = {
      position: DESKS[employee.id],
      facing: "right",
      moving: false,
    };
  }

  return sprites;
}

/** Semantic activity -> the spot the sprite should occupy. */
function targetFor(employeeId: EmployeeId, state: WorkflowState): Point {
  const activity = state.employees[employeeId];
  const stage = STAGES[state.activeStageIndex];
  const isActive = stage?.assignee === employeeId;

  // Once the report is delivered the active stage index runs past the list, so
  // the reporter would otherwise snap home and leave the bubble unattended.
  const reportStage = STAGES[STAGES.length - 1];

  if (state.report !== null && reportStage.assignee === employeeId) {
    return REPORT_ZONE;
  }

  if (!isActive) {
    return DESKS[employeeId];
  }

  if (
    activity === "walking" ||
    activity === "working" ||
    activity === "reviewing" ||
    (state.status === "awaiting_approval" && stage.requiresApproval)
  ) {
    return stage.zone === "report" ? REPORT_ZONE : WORK_ZONE;
  }

  if (activity === "done" && stage.zone === "report") {
    return REPORT_ZONE;
  }

  return DESKS[employeeId];
}

export function useOfficeAnimation(state: WorkflowState): SpriteMap {
  const [sprites, setSprites] = useState<SpriteMap>(initialSprites);

  useEffect(() => {
    setSprites((current) => {
      let changed = false;
      const next = { ...current };

      for (const employee of CAREER_TEAM) {
        const target = targetFor(employee.id, state);
        const previous = current[employee.id];
        const moving = state.employees[employee.id] === "walking";

        const sameSpot =
          previous.position.x === target.x && previous.position.y === target.y;

        if (sameSpot && previous.moving === moving) {
          continue;
        }

        next[employee.id] = {
          position: target,
          facing: target.x >= previous.position.x ? "right" : "left",
          moving,
        };

        changed = true;
      }

      return changed ? next : current;
    });
  }, [state]);

  // A reset clears the workflow entirely; snap everyone home.
  useEffect(() => {
    if (state.status === "idle") {
      setSprites(initialSprites());
    }
  }, [state.status]);

  return sprites;
}

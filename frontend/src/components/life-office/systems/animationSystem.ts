/**
 * Animation System
 *
 * Single requestAnimationFrame loop that updates all animation state:
 * - Agent position interpolation along paths
 *
 * This is the core animation tick that drives all movement.
 *
 * Life Office scope: bubble timing, boss availability, queue advancement and
 * compaction were removed for the first render. The RAF loop, setAgentPath,
 * path interpolation, batched movement and the arrival callback are unchanged
 * from source.
 */

import { useGameStore } from "../adapter/gameStore";
import type {
  AgentMovement,
  AgentPhase,
  PathState,
  Position,
} from "../adapter/types";
import { calculatePath, updateAgentObstacle } from "./pathfinding";
import { collisionManager } from "./agentCollision";

// ============================================================================
// CONSTANTS
// ============================================================================

const MOVEMENT_SPEED = 200; // pixels per second

// ============================================================================
// ANIMATION SYSTEM CLASS
// ============================================================================

/**
 * Port the animation tick uses to talk back to the agent-machine layer.
 * Wired in one composition root (gameRuntime.ts) so AnimationSystem never
 * imports agentMachineService at runtime — breaking the machines↔systems
 * import cycle (ARC-017).
 *
 * `notifyBubbleComplete` / `notifyBossAvailable` were dropped with the bubble
 * and queue sections; restore them alongside those.
 */
export interface AnimationListener {
  notifyArrival(agentId: string, phase: AgentPhase): void;
}

interface AnimationState {
  isRunning: boolean;
  lastTickTime: number;
  rafId: number | null;
}

class AnimationSystem {
  private state: AnimationState = {
    isRunning: false,
    lastTickTime: 0,
    rafId: null,
  };

  private listener: AnimationListener | null = null;

  /**
   * Wire the machine-layer listener. Called once from the composition root
   * (gameRuntime.ts) so this module never imports agentMachineService at runtime.
   */
  setListener(listener: AnimationListener | null): void {
    this.listener = listener;
  }

  /**
   * Start the animation loop.
   */
  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.lastTickTime = performance.now();
    this.tick();
  }

  /**
   * Stop the animation loop.
   */
  stop(): void {
    this.state.isRunning = false;
    if (this.state.rafId !== null) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
  }

  /**
   * Check if animation system is running.
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Calculate and set a path for an agent.
   * Skips recalculation if agent is already moving to the same destination.
   */
  setAgentPath(agentId: string, target: Position): void {
    const store = useGameStore.getState();
    const agent = store.agents.get(agentId);
    if (!agent) return;

    // Check if agent is already at the target (within 5px tolerance)
    const dx = Math.abs(agent.currentPosition.x - target.x);
    const dy = Math.abs(agent.currentPosition.y - target.y);
    if (dx < 5 && dy < 5) {
      // Already at destination - trigger immediate arrival
      store.updateAgentPath(agentId, null);
      this.handleArrival(agentId, agent.phase);
      return;
    }

    // Check if agent is already moving to this target (within 10px tolerance)
    // This prevents path recalculation mid-movement which causes skipping
    if (agent.path && agent.targetPosition) {
      const targetDx = Math.abs(agent.targetPosition.x - target.x);
      const targetDy = Math.abs(agent.targetPosition.y - target.y);
      if (targetDx < 10 && targetDy < 10) {
        // Already heading to same destination - skip path reset
        return;
      }
    }

    // Register agent for collision tracking if not already
    collisionManager.registerAgent(agentId, agent.currentPosition);

    const waypoints = calculatePath(agent.currentPosition, target, agentId);

    if (waypoints.length > 1) {
      store.updateAgentTarget(agentId, target);
      store.updateAgentPath(agentId, {
        waypoints,
        currentIndex: 0,
        progress: 0,
      });
    } else {
      // Path calculation returned no valid path or single point - treat as arrival
      store.updateAgentPath(agentId, null);
      this.handleArrival(agentId, agent.phase);
    }
  }

  /**
   * Register a new agent for collision tracking.
   */
  registerAgent(agentId: string, position: Position): void {
    collisionManager.registerAgent(agentId, position);
  }

  /**
   * Unregister an agent from collision tracking.
   */
  unregisterAgent(agentId: string): void {
    collisionManager.unregisterAgent(agentId);
  }

  // ==========================================================================
  // MAIN TICK LOOP
  // ==========================================================================

  private tick = (): void => {
    if (!this.state.isRunning) return;

    const now = performance.now();
    const deltaMs = now - this.state.lastTickTime;
    const deltaSeconds = deltaMs / 1000;
    this.state.lastTickTime = now;

    // Update all systems
    this.updateAgentPositions(deltaSeconds);

    // Schedule next frame
    this.state.rafId = requestAnimationFrame(this.tick);
  };

  // ==========================================================================
  // POSITION UPDATES
  // ==========================================================================

  private updateAgentPositions(deltaSeconds: number): void {
    const store = useGameStore.getState();

    // Collect every moving agent's position/path delta, then apply them in one
    // store write at the end (ARC-006: was one Map clone + one subscriber
    // notification per agent per frame). The loop reads from the snapshot taken
    // above, so batching the writes is behavior-equivalent. Non-moving agents
    // keep their object reference, so React.memo on the sprites bails out.
    const movements: AgentMovement[] = [];
    const arrivals: Array<{ agentId: string; phase: AgentPhase }> = [];

    for (const [agentId, agent] of store.agents) {
      if (!agent.path) {
        // Still update obstacle position for stationary agents
        updateAgentObstacle(agentId, agent.currentPosition);
        collisionManager.updatePosition(agentId, agent.currentPosition);
        continue;
      }

      // Calculate what the next position would be
      const result = this.updatePathProgress(
        {
          currentPosition: agent.currentPosition,
          targetPosition: agent.targetPosition,
          path: agent.path,
        },
        deltaSeconds,
      );
      if (!result) continue;

      const { newPosition, newPath, arrived } = result;

      // Agent collision disabled - agents pass through each other
      // This simplifies pathfinding and avoids deadlock issues

      // Update obstacle position for pathfinding
      updateAgentObstacle(agentId, newPosition);

      // Update collision manager position for agent-to-agent collision
      collisionManager.updatePosition(agentId, newPosition);

      // Queue the delta: path omitted => unchanged, null => cleared on arrival.
      if (arrived) {
        movements.push({ agentId, position: newPosition, path: null });
        arrivals.push({ agentId, phase: agent.phase });
      } else if (newPath) {
        movements.push({ agentId, position: newPosition, path: newPath });
      } else {
        movements.push({ agentId, position: newPosition });
      }
    }

    // One set() per tick instead of one per agent. Non-moving agents are not in
    // `movements`, so their entries in the new Map keep the same object ref.
    if (movements.length > 0) {
      store.applyAgentMovements(movements);
    }

    // Arrival notifications fire after the batched state update.
    for (const { agentId, phase } of arrivals) {
      this.handleArrival(agentId, phase);
    }
  }

  private updatePathProgress(
    agent: {
      currentPosition: Position;
      targetPosition: Position | null;
      path: PathState;
    },
    deltaSeconds: number,
  ): {
    newPosition: Position;
    newPath: PathState | null;
    arrived: boolean;
  } | null {
    const { waypoints } = agent.path;
    let { currentIndex, progress } = agent.path;

    // Safety check
    if (currentIndex >= waypoints.length - 1) {
      return {
        newPosition: waypoints[waypoints.length - 1],
        newPath: null,
        arrived: true,
      };
    }

    // Calculate total distance to move this frame
    let remainingDistance = MOVEMENT_SPEED * deltaSeconds;

    // Advance through waypoints until we've used all our movement distance
    while (remainingDistance > 0 && currentIndex < waypoints.length - 1) {
      const current = waypoints[currentIndex];
      const next = waypoints[currentIndex + 1];

      // Calculate segment length
      const segmentDx = next.x - current.x;
      const segmentDy = next.y - current.y;
      const segmentLength = Math.sqrt(
        segmentDx * segmentDx + segmentDy * segmentDy,
      );

      // Skip zero-length segments
      if (segmentLength < 0.1) {
        currentIndex++;
        progress = 0;
        continue;
      }

      // Calculate remaining distance in current segment
      const remainingInSegment = (1 - progress) * segmentLength;

      if (remainingDistance >= remainingInSegment) {
        // Move past this waypoint to the next segment
        remainingDistance -= remainingInSegment;
        currentIndex++;
        progress = 0;
      } else {
        // Stay within this segment - calculate final position
        progress += remainingDistance / segmentLength;
        remainingDistance = 0;
      }
    }

    // Check if we've reached the end
    if (currentIndex >= waypoints.length - 1) {
      return {
        newPosition: waypoints[waypoints.length - 1],
        newPath: null,
        arrived: true,
      };
    }

    // Calculate final interpolated position along current segment
    const current = waypoints[currentIndex];
    const next = waypoints[currentIndex + 1];
    const segmentDx = next.x - current.x;
    const segmentDy = next.y - current.y;

    const newPosition: Position = {
      x: current.x + segmentDx * progress,
      y: current.y + segmentDy * progress,
    };

    return {
      newPosition,
      newPath: {
        waypoints,
        currentIndex,
        progress,
      },
      arrived: false,
    };
  }

  private handleArrival(agentId: string, phase: AgentPhase): void {
    this.listener?.notifyArrival(agentId, phase);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const animationSystem = new AnimationSystem();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useEffect } from "react";

/**
 * React hook to start/stop the animation system.
 * Should be called from the main game component.
 */
export function useAnimationSystem(): void {
  useEffect(() => {
    animationSystem.start();
    return () => animationSystem.stop();
  }, []);
}

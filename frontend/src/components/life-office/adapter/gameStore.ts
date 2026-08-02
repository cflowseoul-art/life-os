/**
 * Adapter game store — replaces `@/stores/gameStore` for the copied visual layer.
 *
 * Seeded with five hard-coded employees sitting at their desks. NOTHING writes to
 * this store yet: no workflow, no reducer, no bridge. Step 6 adds `bridge.ts` as
 * the single writer; until then the scene renders a static office.
 *
 * The agent collection is a `Map<string, AgentAnimationState>` because that is the
 * exact shape `Elevator.tsx` consumes. It is not a Record keyed by AgentId.
 */

import { create } from "zustand";

import { DESK_POSITIONS } from "./constants";
import { AGENT_IDS, BOSS_AGENT_ID } from "./types";
import type {
  AgentAnimationState,
  AgentId,
  AgentMovement,
  AgentPhase,
  BossAnimationState,
  BossState,
  BubbleContent,
  ElevatorState,
  PathState,
  WhiteboardData,
  WhiteboardMode,
  Position,
  TodoItem,
} from "./types";

const NAMES: Record<AgentId, string> = {
  research: "김리서치",
  analysis: "박분석",
  draft: "이작성",
  review: "최검수",
  manager: "한매니저",
};

const COLORS: Record<AgentId, string> = {
  research: "#6aa9ff",
  analysis: "#5fd0a8",
  draft: "#ffc861",
  review: "#d28bff",
  manager: "#ff8b8b",
};

function seedAgents(): Map<string, AgentAnimationState> {
  const agents = new Map<string, AgentAnimationState>();

  AGENT_IDS.filter((id) => id !== BOSS_AGENT_ID).forEach((id, index) => {
    agents.set(id, {
      id,
      name: NAMES[id],
      color: COLORS[id],
      number: index + 1,
      desk: index + 1,
      currentTask: null,
      backendState: "idle",
      characterType: null,
      parentId: null,
      currentPosition: { ...DESK_POSITIONS[id] },
      targetPosition: null,
      phase: "idle",
      bubble: { content: null },
      isTyping: false,
      path: null,
    });
  });

  return agents;
}

type GameStore = {
  agents: Map<string, AgentAnimationState>;
  /** Gates DebugOverlays and CityWindow's fast-time toggle. */
  debugMode: boolean;
  /** CityWindow derives its sky seed from this. "None" = simulation. */
  sessionId: string;
  /** True once sprite textures have loaded; gates LoadingScreen. */
  ready: boolean;

  // --- required by game/OfficeGame.tsx (static defaults for now) ----------
  /** 한매니저 renders as BossSprite only — never as an AgentSprite. */
  boss: BossAnimationState;
  todos: TodoItem[];
  elevatorState: ElevatorState;
  contextUtilization: number;
  isCompacting: boolean;
  printReport: boolean;
  showPaths: boolean;
  showQueueSlots: boolean;
  showPhaseLabels: boolean;
  showObstacles: boolean;

  // --- required by game/Whiteboard.tsx ------------------------------------
  whiteboardData: WhiteboardData;
  whiteboardMode: WhiteboardMode;
  setWhiteboardMode: (mode: WhiteboardMode) => void;
  cycleWhiteboardMode: () => void;

  setAgentPosition: (id: string, currentPosition: Position) => void;
  setAgentTarget: (id: string, targetPosition: Position | null) => void;
  setAgentPhase: (id: string, phase: AgentPhase) => void;
  setAgentBubble: (id: string, content: BubbleContent | null) => void;
  setReady: (ready: boolean) => void;
  reset: () => void;

  // --- required by systems/animationSystem.ts -----------------------------
  updateAgentPath: (id: string, path: PathState | null) => void;
  updateAgentTarget: (id: string, targetPosition: Position | null) => void;
  /** Applies one tick's worth of deltas in a single set(). */
  applyAgentMovements: (movements: AgentMovement[]) => void;

  // --- required by game/OfficeGame.tsx debug controls ---------------------
  // --- required by adapter/workflowBridge.ts ------------------------------
  setBossBubble: (content: BubbleContent | null) => void;
  setBossState: (backendState: BossState) => void;

  setDebugMode: (enabled: boolean) => void;
  toggleDebugOverlay: (
    overlay: "paths" | "queueSlots" | "phaseLabels" | "obstacles",
  ) => void;
};

function patch(
  state: GameStore,
  id: string,
  fields: Partial<AgentAnimationState>,
): Pick<GameStore, "agents"> {
  const agent = state.agents.get(id);

  if (!agent) {
    return { agents: state.agents };
  }

  const agents = new Map(state.agents);
  agents.set(id, { ...agent, ...fields });

  return { agents };
}

export const useGameStore = create<GameStore>((set) => ({
  agents: seedAgents(),
  debugMode: false,
  sessionId: "None",
  ready: false,

  boss: {
    position: { ...DESK_POSITIONS.manager },
    backendState: "idle",
    currentTask: null,
    inUseBy: null,
    isTyping: false,
    bubble: { content: null },
  },
  todos: [],
  elevatorState: "closed",
  contextUtilization: 0,
  isCompacting: false,
  printReport: false,
  showPaths: false,
  showQueueSlots: false,
  showPhaseLabels: false,
  showObstacles: false,

  // Initial values from the source whiteboardSlice.
  whiteboardData: {
    toolUsage: {},
    taskCompletedCount: 0,
    bugFixedCount: 0,
    coffeeBreakCount: 0,
    codeWrittenCount: 0,
    recentErrorCount: 0,
    recentSuccessCount: 0,
    activityLevel: 0,
    consecutiveSuccesses: 0,
    lastIncidentTime: null,
    agentLifespans: [],
    newsItems: [],
    coffeeCups: 0,
    fileEdits: {},
    backgroundTasks: [],
  },
  whiteboardMode: 0 as WhiteboardMode,
  setWhiteboardMode: (whiteboardMode) => set({ whiteboardMode }),
  cycleWhiteboardMode: () =>
    set((state) => ({
      whiteboardMode: (((state.whiteboardMode + 1) % 12) as WhiteboardMode),
    })),

  setAgentPosition: (id, currentPosition) =>
    set((state) => patch(state, id, { currentPosition })),
  setAgentTarget: (id, targetPosition) =>
    set((state) => patch(state, id, { targetPosition })),
  setAgentPhase: (id, phase) => set((state) => patch(state, id, { phase })),
  setAgentBubble: (id, content) =>
    set((state) => patch(state, id, { bubble: { content } })),
  setReady: (ready) => set({ ready }),
  reset: () => set({ agents: seedAgents() }),

  updateAgentPath: (id, path) => set((state) => patch(state, id, { path })),
  updateAgentTarget: (id, targetPosition) =>
    set((state) => patch(state, id, { targetPosition })),

  applyAgentMovements: (movements) =>
    set((state) => {
      // One Map clone per tick, not per agent. Agents absent from `movements`
      // keep their existing object reference so memoized sprites bail out.
      const agents = new Map(state.agents);

      for (const move of movements) {
        const agent = agents.get(move.agentId);
        if (!agent) continue;

        agents.set(move.agentId, {
          ...agent,
          currentPosition: move.position,
          // omitted => unchanged; null => cleared on arrival
          path: move.path === undefined ? agent.path : move.path,
        });
      }

      return { agents };
    }),

  setBossBubble: (content) =>
    set((state) => ({ boss: { ...state.boss, bubble: { content } } })),
  setBossState: (backendState) =>
    set((state) => ({ boss: { ...state.boss, backendState } })),

  setDebugMode: (enabled) => set({ debugMode: enabled }),
  toggleDebugOverlay: (overlay) =>
    set((state) =>
      overlay === "paths"
        ? { showPaths: !state.showPaths }
        : overlay === "queueSlots"
          ? { showQueueSlots: !state.showQueueSlots }
          : overlay === "phaseLabels"
            ? { showPhaseLabels: !state.showPhaseLabels }
            : { showObstacles: !state.showObstacles },
    ),
}));

// Re-exported so consumers can import the type from the store module, matching
// how the original Claude Office `@/stores/gameStore` exported it.
export type { AgentAnimationState } from "./types";

// --- Selectors required by the copied components ---------------------------
// CityWindow.tsx calls useGameStore(selectDebugMode) / useGameStore(selectSessionId).

export const selectDebugMode = (state: GameStore): boolean => state.debugMode;

export const selectSessionId = (state: GameStore): string => state.sessionId;

export const selectAgents = (state: GameStore) => state.agents;
export const selectBoss = (state: GameStore) => state.boss;
export const selectTodos = (state: GameStore) => state.todos;
export const selectShowPaths = (state: GameStore) => state.showPaths;
export const selectShowQueueSlots = (state: GameStore) => state.showQueueSlots;
export const selectShowPhaseLabels = (state: GameStore) =>
  state.showPhaseLabels;
export const selectShowObstacles = (state: GameStore) => state.showObstacles;
export const selectElevatorState = (state: GameStore) => state.elevatorState;
export const selectContextUtilization = (state: GameStore) =>
  state.contextUtilization;
export const selectIsCompacting = (state: GameStore) => state.isCompacting;
export const selectPrintReport = (state: GameStore) => state.printReport;
export const selectToolUsesSinceCompaction = (_state: GameStore) => 0;

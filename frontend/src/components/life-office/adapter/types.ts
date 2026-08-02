/**
 * Adapter types — replaces `@/types` for the copied Claude Office visual layer.
 *
 * These describe PIXELS and rendering state only. No workflow meaning lives here;
 * the bridge (Step 6) is what translates semantic state into these shapes.
 */

export type Position = { x: number; y: number };

/** The five Life Office employees. Hard-coded — no workflow import. */
export type AgentId = "research" | "analysis" | "draft" | "review" | "manager";

export const AGENT_IDS: readonly AgentId[] = [
  "research",
  "analysis",
  "draft",
  "review",
  "manager",
] as const;

/**
 * Visual phase consumed by AgentSprite / animationSystem.
 * Exact union from the source `stores/slices/types.ts`.
 */
export type AgentPhase =
  | "idle" // At desk, working
  | "arriving" // Just spawned, walking to queue
  | "in_arrival_queue" // Waiting in arrival queue
  | "walking_to_ready" // Moving to position 0 (ready to talk spot)
  | "conversing" // At position 0, talking to boss
  | "walking_to_boss" // Moving to boss desk slot
  | "at_boss" // Brief pause at boss desk
  | "walking_to_desk" // Moving from boss to assigned desk
  | "departing" // Removed from backend, walking to queue
  | "in_departure_queue" // Waiting in departure queue
  | "walking_to_elevator" // Moving from boss to elevator
  | "in_elevator"; // In elevator, about to be removed

/** Boss render state, as consumed by OfficeGame/BossSprite. */
export type BossAnimationState = {
  position: Position;
  backendState: BossState;
  currentTask: string | null;
  inUseBy: "arrival" | "departure" | null;
  isTyping: boolean;
  bubble: { content: BubbleContent | null };
};

export type ElevatorState = "closed" | "opening" | "open" | "closing";

/**
 * Whiteboard display mode index (0–11).
 * Pure frontend concept — the backend has no equivalent.
 */
export type WhiteboardMode =
  | 0 // Todo List — hotkey T
  | 1 // Remote Workers (background tasks) — hotkey B
  | 2 // Tool Pizza
  | 3 // Org Chart
  | 4 // Stonks
  | 5 // Weather
  | 6 // Safety Board
  | 7 // Timeline
  | 8 // News Ticker
  | 9 // Coffee
  | 10 // Heat Map
  | 11; // Kanban Board — hotkey K

// --- from `types/generated.ts` (backend-derived; do not hand-edit shapes) ---

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  task_id?: string;
  content: string;
  status: TodoStatus;
  active_form?: string | null;
  description?: string | null;
  blocks?: string[];
  blocked_by?: string[];
  owner?: string | null;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface Agent {
  id: string;
  nativeId?: string | null;
  name?: string | null;
  color: string;
  number: number;
  state: AgentState;
  desk?: number | null;
  bubble?: BubbleContent | null;
  currentTask?: string | null;
  position?: Position;
  characterType?: string | null;
  parentSessionId?: string | null;
  parentId?: string | null;
  [k: string]: unknown;
}

export interface BackgroundTask {
  taskId: string;
  status: string;
  summary?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  [k: string]: unknown;
}

export interface KanbanTask {
  taskId: string;
  subject: string;
  status: string;
  assignee?: string | null;
  linearId?: string | null;
  [k: string]: unknown;
}

export interface NewsItem {
  category: string;
  headline: string;
  timestamp: string;
  [k: string]: unknown;
}

export interface AgentLifespan {
  agentId: string;
  agentName: string;
  color: string;
  startTime: string;
  endTime?: string | null;
  [k: string]: unknown;
}

export interface Toolusage {
  [k: string]: number;
}

export interface Fileedits {
  [k: string]: number;
}

export interface WhiteboardData {
  toolUsage?: Toolusage;
  kanbanTasks?: KanbanTask[];
  taskCompletedCount?: number;
  bugFixedCount?: number;
  coffeeBreakCount?: number;
  codeWrittenCount?: number;
  recentErrorCount?: number;
  recentSuccessCount?: number;
  activityLevel?: number;
  consecutiveSuccesses?: number;
  lastIncidentTime?: string | null;
  agentLifespans?: AgentLifespan[];
  newsItems?: NewsItem[];
  coffeeCups?: number;
  fileEdits?: Fileedits;
  backgroundTasks?: BackgroundTask[];
  [k: string]: unknown;
}

/** A calculated path plus how far along it the agent currently is. */
export type PathState = {
  waypoints: Position[];
  currentIndex: number;
  progress: number;
};

/**
 * One agent's per-frame delta, applied in a single batched store write.
 * `path` omitted means unchanged; `null` means cleared on arrival.
 */
export type AgentMovement = {
  agentId: string;
  position: Position;
  path?: PathState | null;
};

/**
 * Movement/lifecycle state, distinct from `AgentPhase`.
 *
 * Members recovered from the switch in `systems/pathfinding.ts`
 * `getMovementType()`, which enumerates every case it routes on.
 */
export type AgentState =
  | "arriving"
  | "reporting"
  | "walking_to_desk"
  | "working"
  | "thinking"
  | "waiting_permission"
  | "completed"
  | "waiting"
  | "reporting_done"
  | "leaving"
  | "in_elevator"
  | "idle";

/**
 * Boss render state. Members recovered verbatim from `BossSprite.tsx`'s
 * `_STATE_COLORS` record, which enumerates the full union.
 */
export type BossState =
  | "idle"
  | "phone_ringing"
  | "on_phone"
  | "receiving"
  | "working"
  | "delegating"
  | "waiting_permission"
  | "reviewing"
  | "completing";

/**
 * The boss IS the manager. Claude Office rendered the boss as a separate actor;
 * Life Office has 한매니저 in that seat, so `BossSprite` maps onto this employee
 * rather than adding a sixth.
 */
export const BOSS_AGENT_ID: AgentId = "manager";

/** Speech-bubble payload rendered by `shared/drawBubble.ts`. */
export type BubbleContent = {
  text: string;
  /** Key into `shared/iconMap.ts`; omitted means no badge. */
  icon?: string;
  /**
   * Bubble shape. Both AgentSprite and BossSprite destructure this with a
   * `"thought"` default; the value is passed straight to `drawBubble`.
   */
  type?: "thought" | "speech";
};

/**
 * Per-agent render state.
 *
 * Field names and nesting are dictated by the copied components (`Elevator.tsx`
 * reads `currentPosition`, `bubble.content`, `color`, `number`, `isTyping`), not
 * chosen here. Do not rename without checking every consumer.
 */
export type AgentAnimationState = {
  id: string;
  name: string;
  /** Sprite tint, CSS color string. */
  color: string;
  /** Desk/badge number shown on the sprite. */
  number: number;
  /** Current pixel position on the office floor. */
  currentPosition: Position;
  /** Where the agent is heading; null when parked. */
  targetPosition: Position | null;
  phase: AgentPhase;
  /** Wrapped — the source reads `agent.bubble.content`. */
  bubble: { content: BubbleContent | null };
  isTyping: boolean;
  /** Active path, or null when parked. Driven by `animationSystem`. */
  path: PathState | null;
  /** Desk number the agent occupies, 1-based. */
  desk: number;
  currentTask: string | null;
  /** From agentSlice: mirrors the backend agent's fields. */
  backendState: AgentState;
  characterType: string | null;
  parentId: string | null;
};

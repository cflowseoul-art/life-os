/**
 * Adapter stubs — stand-ins for Claude Office modules the visual layer imports
 * but Life Office has no equivalent of.
 *
 * Each stub is deliberately inert: identity functions, defaults, empty lists.
 * They exist so the copied components compile and render, not to add behaviour.
 */

import { create } from "zustand";

// --- @/hooks/useTranslation ------------------------------------------------
/** Identity translator. Life Office ships Korean strings inline. */
export function useTranslation() {
  return { t: (key: string) => key };
}

// --- @/stores/preferencesStore ---------------------------------------------
/** Digital-clock display format, consumed by DigitalClock.tsx. */
export type ClockFormat = "12h" | "24h";

/** Which clock face WallClock.tsx renders. */
export type ClockType = "analog" | "digital";

type PreferencesStore = {
  showDebugOverlays: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  clockType: ClockType;
  clockFormat: ClockFormat;
  cycleClockMode: () => void;
  /** AgentSprite gates its click handler on this. Inert in Life Office. */
  clickToFocusEnabled: boolean;
};

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  showDebugOverlays: false,
  reducedMotion: false,
  soundEnabled: false,
  clockType: "analog",
  clockFormat: "24h",
  clickToFocusEnabled: false,
  // Original cycles analog -> digital 24h -> digital 12h -> analog.
  cycleClockMode: () =>
    set((state) =>
      state.clockType === "analog"
        ? { clockType: "digital", clockFormat: "24h" }
        : state.clockFormat === "24h"
          ? { clockType: "digital", clockFormat: "12h" }
          : { clockType: "analog", clockFormat: "24h" },
    ),
}));

// --- @/stores/attentionStore -----------------------------------------------
type AttentionStore = {
  /** Agent ids currently flagged for attention. Always empty for now. */
  attention: string[];
  /**
   * Opens the focus popup for an agent. No-op: Life Office has no focus popup,
   * and AgentSprite only calls this behind `clickToFocusEnabled`, which is false.
   */
  openFocusPopup: (agentId: string, screenX: number, screenY: number) => void;
};

export const useAttentionStore = create<AttentionStore>(() => ({
  attention: [],
  openFocusPopup: () => {},
}));

// --- @/stores/navigationStore + @/types/navigation -------------------------
/** Life Office is a single floor; the source's multi-floor nav is stubbed out. */
export const LOBBY_FLOOR_ID = "lobby";

type FloorConfig = {
  id: string;
  name: string;
  icon: string;
  accent: string;
};

type NavigationStore = {
  currentFloorId: string;
  floorId: string;
  buildingConfig: { floors: FloorConfig[] } | null;
};

export const useNavigationStore = create<NavigationStore>(() => ({
  currentFloorId: LOBBY_FLOOR_ID,
  floorId: LOBBY_FLOOR_ID,
  buildingConfig: null,
}));

// --- @/systems/hmrCleanup --------------------------------------------------
/** No HMR agent-state teardown in Life Office; the store is seeded statically. */
export function performSoftReset(): void {}

export function getHmrVersion(): number {
  return 0;
}

// --- @/systems/gameRuntime -------------------------------------------------
/**
 * Composition root that wires animationSystem to the machine layer. Life Office
 * has no machines, so wiring is a no-op — the bridge drives movement directly.
 */
export function wireGameRuntime(): void {}

export function unwireGameRuntime(): void {}

// --- @/systems/compactionAnimation -----------------------------------------
/** Context compaction is Claude-only. Static idle values keep the boss still. */
export function useCompactionAnimation() {
  return {
    phase: "idle" as const,
    bossPosition: null,
    bossScale: 1,
    jumpOffset: 0,
    isStomping: false,
    animatedContextUtilization: 0,
  };
}

// --- @/components/command/useCommandCenterPeers ----------------------------
/** No remote peers in Life Office. */
export function useCommandCenterPeers(): [] {
  return [];
}

// --- @/utils/bubbleText ----------------------------------------------------
/** Clamps bubble text so `drawBubble` never overflows its box. */
export function truncateBubbleText(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// --- @/utils/event-type-styles ---------------------------------------------
/** Single neutral style; Claude tool-event colouring is not carried over. */
export function eventTypeStyle(_type: string): { color: number; label: string } {
  return { color: 0x8b8b95, label: "" };
}

// --- @/constants/quotes ----------------------------------------------------
/** Idle flavour text shown in bubbles during downtime. */
export const QUOTES: string[] = [
  "커피 한 잔 하고 올게요",
  "잠깐 정리 중입니다",
  "다음 작업 대기 중",
];

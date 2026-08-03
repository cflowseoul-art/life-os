/**
 * What each capability's data belongs to.
 *
 * Declared here, once, and required: a capability with no scope cannot be
 * routed, cannot be written, and cannot be read. Nothing infers ownership from
 * who happens to be logged in (review §A).
 *
 *   personal   isolated per user — one member's Career never reaches another's
 *   household  shared by everyone in the household, with no owner column
 */

import type { Scope } from "../identity/types.ts";

export const CAPABILITY_SCOPE = {
  career: "personal",
  health: "personal",
  finance: "household",
  asset: "household",
  treasury: "household",
  home: "household",
  operations: "household",
  ceo: "household",
} as const satisfies Record<string, Scope>;

export type ScopedCapability = keyof typeof CAPABILITY_SCOPE;

/**
 * The scope of a capability.
 *
 * An unknown capability is personal — the safe direction. A leak is
 * irreversible; an over-isolated record is merely inconvenient.
 */
export function scopeOf(capability: string): Scope {
  return (CAPABILITY_SCOPE as Record<string, Scope>)[capability] ?? "personal";
}

export function isPersonal(capability: string): boolean {
  return scopeOf(capability) === "personal";
}

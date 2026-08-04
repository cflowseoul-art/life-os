/**
 * Whose knowledge this is.
 *
 * Career knowledge belongs to one person in one household. Not to the process,
 * not to the repository, and not to whoever happens to be signed in — which is
 * why there is no ambient current representative anywhere in this module and no
 * way to read knowledge without naming one.
 *
 * Both halves are required. A household without a user would return one
 * person's career to their partner; a user without a household is not a
 * representative this system recognises. Neither is defaulted, and a missing
 * half is a failure rather than a wildcard.
 */

import type { HouseholdId, UserId } from "../../../identity/types.ts";
import type { ActorContext } from "../../../identity/types.ts";

/** The key every read is scoped by. */
export type RepresentativeKey = {
  householdId: HouseholdId;
  userId: UserId;
};

/** The representative a request is being handled for. */
export function representativeOf(actor: ActorContext): RepresentativeKey {
  return { householdId: actor.household.id, userId: actor.user.id };
}

/**
 * Refuses an incomplete key before it can reach a store.
 *
 * A blank id is the dangerous case: it reads as a valid string, matches nothing
 * or — worse, depending on the store — matches everything.
 */
export function assertRepresentative(key: RepresentativeKey | undefined | null): RepresentativeKey {
  if (!key) throw new Error("대표를 지정하지 않았습니다.");

  const householdId = (key.householdId ?? "").trim();
  const userId = (key.userId ?? "").trim();

  if (householdId === "") throw new Error("householdId가 없습니다.");
  if (userId === "") throw new Error("userId가 없습니다.");

  return { householdId, userId };
}

export function sameRepresentative(a: RepresentativeKey, b: RepresentativeKey): boolean {
  return a.householdId === b.householdId && a.userId === b.userId;
}

/** For diagnostics and refusal messages. Never used as a store key. */
export function describeRepresentative(key: RepresentativeKey): string {
  return `${key.householdId}/${key.userId}`;
}

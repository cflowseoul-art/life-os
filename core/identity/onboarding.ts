/**
 * First login, and joining.
 *
 * An unknown Google account becomes a user. A user with no household gets one,
 * and becomes its owner. An invited user joins the household they were invited
 * to — the seam exists; the invitation UI does not.
 */

import type { IdentityStore } from "./store.ts";
import type { ActorContext, Session } from "./types.ts";
import type { GoogleIdentity } from "./google.ts";

export async function resolveOrCreate(
  store: IdentityStore,
  identity: GoogleIdentity,
  invitedHouseholdId?: string,
): Promise<{ userId: string; householdId: string }> {
  const existing = await store.userByGoogleId(identity.googleId);
  if (existing) return { userId: existing.id, householdId: existing.householdId };

  if (invitedHouseholdId) {
    const household = await store.householdById(invitedHouseholdId);
    if (!household) throw new Error("초대받은 가구를 찾지 못했습니다.");

    const joined = await store.joinHousehold({
      householdId: invitedHouseholdId,
      googleId: identity.googleId,
      email: identity.email,
      displayName: identity.displayName,
    });

    return { userId: joined.id, householdId: joined.householdId };
  }

  const created = await store.createHouseholdWithOwner({
    householdName: `${identity.displayName}님의 집`,
    googleId: identity.googleId,
    email: identity.email,
    displayName: identity.displayName,
  });

  return { userId: created.user.id, householdId: created.household.id };
}

/** Turns a verified session into the context the domain receives. */
export async function contextFor(store: IdentityStore, session: Session): Promise<ActorContext | null> {
  const user = await store.userById(session.userId);
  if (!user || user.householdId !== session.householdId) return null;

  const household = await store.householdById(user.householdId);
  if (!household) return null;

  return { user, household, session };
}

/**
 * First login, and joining.
 *
 * Entry is decided before this runs (see `allowlist.ts`); by the time a caller
 * gets here, the account is one the household expects.
 *
 * The first allowed account creates the household and owns it. Every allowed
 * account after that joins that same household — there is no public
 * registration, and no path where a stranger's first login makes them owner.
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

  // An allowed account that arrives after the household exists joins it.
  const household = invitedHouseholdId
    ? await store.householdById(invitedHouseholdId)
    : await store.firstHousehold();

  if (household) {
    const joined = await store.joinHousehold({
      householdId: household.id,
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

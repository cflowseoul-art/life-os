/**
 * Who the seeded knowledge belongs to.
 *
 * The bootstrap material is one person's career, verified by hand. It is not
 * starter content and not a template — handing it to a second representative
 * would not be a fallback, it would be a disclosure.
 *
 * **The rule: the seed belongs to the representative who founded the household.**
 *
 * That is a real claim about this system rather than a guess. Entry is decided
 * by the server-side allowlist (`identity/allowlist.ts`), and onboarding records
 * that the first allowed account creates the household and owns it; every
 * account after that joins. So the founding owner is the person whose career
 * this material describes, and everyone else — a partner joining later — starts
 * with nothing rather than with somebody else's history.
 *
 * Deliberately not configuration. The household and user ids are minted at
 * onboarding, so they cannot be written down in advance, and an environment
 * variable naming them would be a second place for the answer to be wrong.
 * Ownership is already recorded, so it is read rather than restated.
 */

import type { ActorContext } from "../../../identity/types.ts";

/**
 * True when this representative is the one the seeded knowledge describes.
 *
 * Pure, and derived entirely from what the request already carries. There is no
 * ambient state, no configuration, and nothing to keep in sync.
 */
export function ownsBootstrapKnowledge(actor: ActorContext): boolean {
  const owner = actor.household.ownerUserId;
  const asking = actor.user.id;

  // A blank on either side would make everybody the owner. Neither is trusted.
  if (typeof owner !== "string" || owner.trim() === "") return false;
  if (typeof asking !== "string" || asking.trim() === "") return false;

  return owner === asking;
}

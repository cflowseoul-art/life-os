/**
 * Who the seeded knowledge belongs to.
 *
 * The bootstrap material is one person's career, verified by hand. It is not
 * starter content and not a template — handing it to a second representative
 * would not be a fallback, it would be a disclosure.
 *
 * **The binding is declared, never inferred.**
 *
 * An earlier version read household ownership: the first allowed account
 * founds the household, so the founder must be the person the seed describes.
 * That is a plausible story and it is not a fact. It made every household's
 * founder the owner of *this* material, and it would have silently handed a
 * career to whoever happened to sign in first after a database reset. Ownership
 * of a household says nothing about whose résumé this is.
 *
 * So the seed names its owner, and the name is matched against the identity the
 * request already carries. `LIFE_OS_CAREER_SEED_EMAIL` holds exactly one
 * address, mirroring `ALLOWED_GOOGLE_EMAILS` — the established way this system
 * says which human it means, server-side, with no path to add one from outside.
 *
 * It fails closed. Unset, blank, or naming more than one account, the binding is
 * absent and **nobody** receives the seed. An unbound seed is unreachable rather
 * than public.
 */

import type { ActorContext } from "../../../identity/types.ts";

/** The one account the seeded material describes. */
export type SeedBinding = { email: string };

function normalise(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * The declared owner, or null when the binding is missing or ambiguous.
 *
 * Read on every call rather than captured at import, so a deployment that fixes
 * its configuration does not need the process restarted to stop being wrong —
 * and so nothing here holds state.
 */
export function seedOwnerBinding(): SeedBinding | null {
  const declared = normalise(process.env.LIFE_OS_CAREER_SEED_EMAIL);
  if (declared === "") return null;

  // More than one name is not a binding, it is a question. Refused rather than
  // resolved by taking the first — a list would quietly widen who gets a career.
  const names = declared.split(/[,\s]+/).filter((n) => n !== "");
  if (names.length !== 1) return null;

  return { email: names[0] };
}

/**
 * True when this representative is the one the seeded knowledge describes.
 *
 * Derived from the authenticated account's own identity and the declared
 * binding, and from nothing else. There is no household role here, no ownership
 * check, and no notion of who arrived first.
 */
export function ownsBootstrapKnowledge(actor: ActorContext): boolean {
  const binding = seedOwnerBinding();
  if (!binding) return false;

  const asking = normalise(actor.user?.email);
  if (asking === "") return false;

  return asking === binding.email;
}

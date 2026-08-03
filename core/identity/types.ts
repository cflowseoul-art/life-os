/**
 * Identity — who is asking, and which household they belong to.
 *
 * Domain code never sees Google, cookies, or requests. It sees `ActorContext`
 * and nothing else, so the authentication mechanism can be replaced without a
 * capability noticing (CLAUDE.md: no domain code imports an OAuth SDK).
 */

export type HouseholdId = string;
export type UserId = string;

export type Household = {
  id: HouseholdId;
  name: string;
  createdAt: string;
  /** The user who created it. Ownership is recorded, never inferred. */
  ownerUserId: UserId;
};

export type User = {
  id: UserId;
  householdId: HouseholdId;
  /** Google's stable subject. Never the email — emails change. */
  googleId: string;
  email: string;
  displayName: string;
  createdAt: string;
};

/**
 * A verified session. Stateless: everything here was signed and can be checked
 * again without a lookup, so multiple devices need no shared server memory.
 */
export type Session = {
  userId: UserId;
  householdId: HouseholdId;
  issuedAt: number;
  expiresAt: number;
};

/**
 * What every request carries into the domain.
 *
 * The only source of actor identity. There is no global current user, and no
 * capability may reach for one.
 */
export type ActorContext = {
  user: User;
  household: Household;
  session: Session;
};

/** Scope of a capability's data. Declared, never inferred (see review §A). */
export type Scope = "personal" | "household";

/**
 * Identity storage port.
 *
 * The domain asks for users and households; it never learns where they live.
 * The file implementation below is the development adapter — a hosted database
 * implements the same interface and nothing else changes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import type { Household, HouseholdId, User } from "./types.ts";

export interface IdentityStore {
  userByGoogleId(googleId: string): Promise<User | null>;
  userById(id: string): Promise<User | null>;
  householdById(id: HouseholdId): Promise<Household | null>;
  /** The household this deployment serves, if one has been created. */
  firstHousehold(): Promise<Household | null>;
  /** Households with no members yet cannot exist: the creator joins on creation. */
  createHouseholdWithOwner(input: {
    householdName: string;
    googleId: string;
    email: string;
    displayName: string;
  }): Promise<{ user: User; household: Household }>;
  /** An invited user joining an existing household. No UI yet; the seam exists. */
  joinHousehold(input: {
    householdId: HouseholdId;
    googleId: string;
    email: string;
    displayName: string;
  }): Promise<User>;
}

type Snapshot = { users: User[]; households: Household[] };

/**
 * Development adapter: one JSON file.
 *
 * Local-only by construction, and deliberately small — it exists so the port is
 * exercised, not so it scales.
 */
export class FileIdentityStore implements IdentityStore {
  constructor(private readonly path = process.env.LIFE_OS_IDENTITY ?? ".life-os/identity.json") {}

  private read(): Snapshot {
    if (!existsSync(this.path)) return { users: [], households: [] };
    return JSON.parse(readFileSync(this.path, "utf8")) as Snapshot;
  }

  private write(snapshot: Snapshot): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  userByGoogleId(googleId: string): Promise<User | null> {
    return Promise.resolve(this.read().users.find((u) => u.googleId === googleId) ?? null);
  }

  userById(id: string): Promise<User | null> {
    return Promise.resolve(this.read().users.find((u) => u.id === id) ?? null);
  }

  householdById(id: HouseholdId): Promise<Household | null> {
    return Promise.resolve(this.read().households.find((h) => h.id === id) ?? null);
  }

  firstHousehold(): Promise<Household | null> {
    const [oldest] = [...this.read().households].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return Promise.resolve(oldest ?? null);
  }

  createHouseholdWithOwner(input: {
    householdName: string;
    googleId: string;
    email: string;
    displayName: string;
  }): Promise<{ user: User; household: Household }> {
    const snapshot = this.read();
    const now = new Date().toISOString();
    const userId = randomUUID();
    const householdId = randomUUID();

    const household: Household = {
      id: householdId,
      name: input.householdName,
      createdAt: now,
      ownerUserId: userId,
    };

    const user: User = {
      id: userId,
      householdId,
      googleId: input.googleId,
      email: input.email,
      displayName: input.displayName,
      createdAt: now,
    };

    snapshot.households.push(household);
    snapshot.users.push(user);
    this.write(snapshot);

    return Promise.resolve({ user, household });
  }

  joinHousehold(input: {
    householdId: HouseholdId;
    googleId: string;
    email: string;
    displayName: string;
  }): Promise<User> {
    const snapshot = this.read();
    const user: User = {
      id: randomUUID(),
      householdId: input.householdId,
      googleId: input.googleId,
      email: input.email,
      displayName: input.displayName,
      createdAt: new Date().toISOString(),
    };

    snapshot.users.push(user);
    this.write(snapshot);

    return Promise.resolve(user);
  }
}

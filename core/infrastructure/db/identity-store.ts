/**
 * Identity, in Postgres.
 *
 * The same port the file adapter implements. Membership is a column on the
 * user, so removing someone is a status change and nothing is destroyed.
 */

import { randomUUID } from "node:crypto";

import { db } from "./pool.ts";
import type { IdentityStore } from "../../identity/store.ts";
import type { Household, HouseholdId, User } from "../../identity/types.ts";

type UserRow = {
  id: string; household_id: string; google_id: string;
  email: string; display_name: string; created_at: Date; status: string;
};

type HouseholdRow = { id: string; name: string; owner_user_id: string; created_at: Date };

function toUser(row: UserRow): User {
  return {
    id: row.id,
    householdId: row.household_id,
    googleId: row.google_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString(),
  };
}

function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresIdentityStore implements IdentityStore {
  /** Removed members are not found, so their sessions resolve to nothing. */
  async userByGoogleId(googleId: string): Promise<User | null> {
    const { rows } = await db().query<UserRow>(
      "SELECT * FROM lifeos.users WHERE google_id = $1 AND status = 'active'",
      [googleId],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async userById(id: string): Promise<User | null> {
    const { rows } = await db().query<UserRow>(
      "SELECT * FROM lifeos.users WHERE id = $1 AND status = 'active'",
      [id],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async householdById(id: HouseholdId): Promise<Household | null> {
    const { rows } = await db().query<HouseholdRow>(
      "SELECT * FROM lifeos.households WHERE id = $1",
      [id],
    );
    return rows[0] ? toHousehold(rows[0]) : null;
  }

  async firstHousehold(): Promise<Household | null> {
    const { rows } = await db().query<HouseholdRow>(
      "SELECT * FROM lifeos.households ORDER BY created_at LIMIT 1",
    );
    return rows[0] ? toHousehold(rows[0]) : null;
  }

  async createHouseholdWithOwner(input: {
    householdName: string; googleId: string; email: string; displayName: string;
  }): Promise<{ user: User; household: Household }> {
    const client = await db().connect();

    try {
      await client.query("BEGIN");

      const userId = randomUUID();
      const householdId = randomUUID();

      const household = await client.query<HouseholdRow>(
        "INSERT INTO lifeos.households (id, name, owner_user_id) VALUES ($1, $2, $3) RETURNING *",
        [householdId, input.householdName, userId],
      );

      const user = await client.query<UserRow>(
        `INSERT INTO lifeos.users (id, household_id, google_id, email, display_name)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, householdId, input.googleId, input.email, input.displayName],
      );

      await client.query("COMMIT");
      return { user: toUser(user.rows[0]), household: toHousehold(household.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async joinHousehold(input: {
    householdId: HouseholdId; googleId: string; email: string; displayName: string;
  }): Promise<User> {
    const { rows } = await db().query<UserRow>(
      `INSERT INTO lifeos.users (id, household_id, google_id, email, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (google_id) DO UPDATE SET status = 'active'
       RETURNING *`,
      [randomUUID(), input.householdId, input.googleId, input.email, input.displayName],
    );

    return toUser(rows[0]);
  }
}

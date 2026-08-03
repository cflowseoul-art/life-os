/**
 * One-time migration: local files → hosted database.
 *
 * Idempotent (events carry their own id and conflict-do-nothing), auditable
 * (every decision is printed), safe to rerun, and explicit about anything it
 * cannot assign. Original files are read and never written.
 *
 *   npx tsx core/infrastructure/db/migrate.ts            # 미리보기
 *   npx tsx core/infrastructure/db/migrate.ts --apply    # 실제 이관
 */

import "dotenv/config";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { db, closeDb } from "./pool.ts";
import { FileIdentityStore } from "../../identity/store.ts";
import type { EventEnvelope } from "../../events/types.ts";

const apply = process.argv.includes("--apply");
const root = process.env.LIFE_OS_ROOT ?? ".life-os";

type Plan = {
  identities: { households: number; users: number };
  events: { household: number; personal: number; legacy: number };
  ambiguous: string[];
};

function readEnvelopes(path: string): EventEnvelope[] {
  if (!existsSync(path)) return [];

  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as EventEnvelope);
}

async function insertEvents(
  envelopes: EventEnvelope[],
  householdId: string,
  scope: "household" | "personal",
  userId: string | null,
): Promise<number> {
  let written = 0;

  for (const e of envelopes) {
    if (!apply) { written += 1; continue; }

    const result = await db().query(
      `INSERT INTO lifeos.events
         (id, household_id, scope, user_id, event_type, capability, actor, payload, source, schema_version, at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id, householdId, scope, scope === "personal" ? userId : null,
        e.event.type, e.capability, JSON.stringify(e.actor), JSON.stringify(e.event),
        e.source, e.schemaVersion, e.at,
      ],
    );

    written += result.rowCount ?? 0;
  }

  return written;
}

async function main(): Promise<void> {
  const plan: Plan = {
    identities: { households: 0, users: 0 },
    events: { household: 0, personal: 0, legacy: 0 },
    ambiguous: [],
  };

  // ── Identity ─────────────────────────────────────────────────────────────
  const identityPath = process.env.LIFE_OS_IDENTITY ?? join(root, "identity.json");

  if (!existsSync(identityPath)) {
    console.log(`identity 파일이 없습니다 (${identityPath}) — 이관할 사용자가 없습니다.`);
  } else {
    const snapshot = JSON.parse(readFileSync(identityPath, "utf8")) as {
      users: { id: string; householdId: string; googleId: string; email: string; displayName: string }[];
      households: { id: string; name: string; ownerUserId: string }[];
    };

    for (const h of snapshot.households) {
      if (apply) {
        await db().query(
          `INSERT INTO lifeos.households (id, name, owner_user_id) VALUES ($1,$2,$3)
           ON CONFLICT (id) DO NOTHING`,
          [h.id, h.name, h.ownerUserId],
        );
      }
      plan.identities.households += 1;
    }

    for (const u of snapshot.users) {
      if (apply) {
        await db().query(
          `INSERT INTO lifeos.users (id, household_id, google_id, email, display_name)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (google_id) DO NOTHING`,
          [u.id, u.householdId, u.googleId, u.email, u.displayName],
        );
      }
      plan.identities.users += 1;
    }
  }

  // ── Scoped streams ───────────────────────────────────────────────────────
  const householdsDir = join(root, "households");

  if (existsSync(householdsDir)) {
    for (const householdId of readdirSync(householdsDir)) {
      const householdFile = join(householdsDir, householdId, "household.jsonl");
      plan.events.household += await insertEvents(readEnvelopes(householdFile), householdId, "household", null);

      const usersDir = join(householdsDir, householdId, "users");
      if (!existsSync(usersDir)) continue;

      for (const file of readdirSync(usersDir)) {
        const userId = basename(file, ".jsonl");
        plan.events.personal += await insertEvents(readEnvelopes(join(usersDir, file)), householdId, "personal", userId);
      }
    }
  }

  // ── Legacy, unscoped ─────────────────────────────────────────────────────
  const legacyPath = process.env.LIFE_OS_LOG ?? join(root, "events.jsonl");
  const legacy = readEnvelopes(legacyPath);

  if (legacy.length > 0) {
    const store = new FileIdentityStore(identityPath);
    const households = existsSync(identityPath)
      ? (JSON.parse(readFileSync(identityPath, "utf8")) as { households: { id: string; ownerUserId: string }[] }).households
      : [];

    if (households.length !== 1) {
      // More than one household, or none: there is no safe owner to assign to.
      plan.ambiguous.push(
        `${legacyPath}: ${String(legacy.length)}건 — 소유 가구를 특정할 수 없습니다 (가구 ${String(households.length)}개)`,
      );
    } else {
      const household = households[0];
      const owner = await store.userById(household.ownerUserId);

      if (!owner) {
        plan.ambiguous.push(`${legacyPath}: ${String(legacy.length)}건 — 가구 소유자를 찾지 못했습니다`);
      } else {
        // Pre-identity events belong to the owner: household capabilities to the
        // household stream, personal ones to the owner's own.
        const { CAPABILITIES } = await import("../../company/manifest.ts");
        const scopeByCapability = new Map(CAPABILITIES.map((c) => [c.id as string, c.scope]));

        // An event belongs to the stream its hold belongs to. The handover names
        // the capability; later events on the same hold inherit it. This is a
        // rule, not a guess — an event with no resolvable hold is reported.
        const capabilityByHold = new Map<string, string>();
        for (const e of legacy) {
          if (e.event.type === "HandedOver") capabilityByHold.set(e.event.holdId, e.event.capability);
        }

        for (const e of legacy) {
          const capability = e.capability ?? capabilityByHold.get(e.event.holdId);
          const scope = capability ? scopeByCapability.get(capability) : undefined;

          if (!scope) {
            plan.ambiguous.push(
              `${legacyPath}: ${e.id} (${e.event.type}) — 소속 hold의 capability를 확인할 수 없습니다`,
            );
            continue;
          }

          plan.events.legacy += await insertEvents([e], household.id, scope, owner.id);
        }
      }
    }
  }

  console.log(apply ? "== 이관 완료 ==" : "== 미리보기 (--apply 로 실제 이관) ==");
  console.log(`  가구 ${String(plan.identities.households)} · 사용자 ${String(plan.identities.users)}`);
  console.log(`  가구 이벤트 ${String(plan.events.household)} · 개인 이벤트 ${String(plan.events.personal)} · 레거시 ${String(plan.events.legacy)}`);

  if (plan.ambiguous.length === 0) console.log("  판단이 필요한 기록: 없음");
  else {
    console.log("  판단이 필요한 기록:");
    for (const line of plan.ambiguous) console.log(`    - ${line}`);
  }

  await closeDb();
}

void main();

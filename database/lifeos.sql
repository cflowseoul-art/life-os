-- Life OS — hosted persistence.
--
-- One schema of its own, so the older tables in this database are untouched.
-- Events are immutable and append-only; nothing here updates or deletes one.

BEGIN;

CREATE SCHEMA IF NOT EXISTS lifeos;

CREATE TABLE IF NOT EXISTS lifeos.households (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  owner_user_id  UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership lives on the user: one household per person, with a status so a
-- removed member loses access without any record being destroyed.
CREATE TABLE IF NOT EXISTS lifeos.users (
  id            UUID PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES lifeos.households(id),
  google_id     TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'removed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_household_idx ON lifeos.users (household_id);

-- The event log. `seq` gives deterministic ordering within a stream; `id` is
-- the envelope's own id, which makes re-running a migration a no-op.
CREATE TABLE IF NOT EXISTS lifeos.events (
  seq             BIGSERIAL PRIMARY KEY,
  id              UUID NOT NULL UNIQUE,
  household_id    UUID NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('personal', 'household')),
  user_id         UUID,
  event_type      TEXT NOT NULL,
  capability      TEXT,
  actor           JSONB NOT NULL,
  payload         JSONB NOT NULL,
  source          TEXT NOT NULL,
  schema_version  INTEGER NOT NULL,
  at              TIMESTAMPTZ NOT NULL,
  CONSTRAINT personal_events_have_a_person
    CHECK (scope = 'household' OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS events_household_idx ON lifeos.events (household_id, scope, seq);
CREATE INDEX IF NOT EXISTS events_personal_idx  ON lifeos.events (household_id, user_id, seq);

-- Which reports a person has read. Per user by definition.
CREATE TABLE IF NOT EXISTS lifeos.report_reads (
  user_id   UUID NOT NULL,
  hold_id   UUID NOT NULL,
  read_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hold_id)
);

COMMIT;

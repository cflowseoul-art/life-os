BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_memberships (
  household_id UUID NOT NULL
    REFERENCES households(id)
    ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  role TEXT NOT NULL
    CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  household_id UUID NOT NULL
    REFERENCES households(id)
    ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('shared', 'personal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_household_id_idx
  ON workspaces (household_id);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  base_unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_aliases (
  alias TEXT PRIMARY KEY,
  canonical_product_id UUID NOT NULL
    REFERENCES products(id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_aliases_product_id_idx
  ON product_aliases (canonical_product_id);

CREATE TABLE IF NOT EXISTS unit_conversions (
  canonical_product_id UUID NOT NULL
    REFERENCES products(id)
    ON DELETE CASCADE,
  from_unit TEXT NOT NULL,
  to_base_factor NUMERIC NOT NULL
    CHECK (to_base_factor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (
    canonical_product_id,
    from_unit
  )
);

CREATE TABLE IF NOT EXISTS inventory_events (
  seq BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'InventoryPurchased',
        'InventoryConsumed',
        'InventoryAdjusted'
      )
    ),
  event_version INTEGER NOT NULL DEFAULT 1
    CHECK (event_version > 0),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  household_id UUID NOT NULL
    REFERENCES households(id),
  workspace_id UUID NOT NULL
    REFERENCES workspaces(id),
  actor_id UUID NOT NULL
    REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  command_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT inventory_events_payload_items_check
    CHECK (
      jsonb_typeof(payload) = 'object'
      AND jsonb_typeof(payload -> 'items') = 'array'
    )
);

CREATE INDEX IF NOT EXISTS inventory_events_workspace_seq_idx
  ON inventory_events (
    workspace_id,
    seq
  );

CREATE INDEX IF NOT EXISTS inventory_events_command_id_idx
  ON inventory_events (command_id);

CREATE INDEX IF NOT EXISTS inventory_events_correlation_id_idx
  ON inventory_events (correlation_id);

CREATE TABLE IF NOT EXISTS inventory_items (
  workspace_id UUID NOT NULL
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  canonical_product_id UUID NOT NULL
    REFERENCES products(id),
  canonical_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL,
  source_type TEXT NOT NULL
    CHECK (
      source_type IN (
        'explicit_text',
        'receipt_confirmed',
        'inferred_status',
        'automation'
      )
    ),
  value_type TEXT NOT NULL
    CHECK (
      value_type IN (
        'explicit_quantity',
        'inferred_status'
      )
    ),
  freshness_status TEXT NOT NULL
    CHECK (
      freshness_status IN (
        'fresh',
        'stale',
        'uncertain'
      )
    ),
  last_seq BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (
    workspace_id,
    canonical_product_id
  )
);

CREATE INDEX IF NOT EXISTS inventory_items_available_idx
  ON inventory_items (
    workspace_id,
    canonical_name
  )
  WHERE quantity > 0;

CREATE TABLE IF NOT EXISTS processed_commands (
  workspace_id UUID NOT NULL
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  command_id UUID NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (
    workspace_id,
    idempotency_key
  )
);

CREATE INDEX IF NOT EXISTS processed_commands_command_id_idx
  ON processed_commands (command_id);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  source_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (
      source_type IN (
        'apple_notes',
        'markdown',
        'web_clip',
        'manual'
      )
    ),
  name TEXT NOT NULL,
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sources_workspace_idx
  ON knowledge_sources (
    workspace_id,
    source_type
  );

CREATE UNIQUE INDEX IF NOT EXISTS
  knowledge_sources_workspace_external_reference_uidx
  ON knowledge_sources (
    workspace_id,
    external_reference
  )
  WHERE external_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  document_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  source_id UUID NOT NULL
    REFERENCES knowledge_sources(source_id)
    ON DELETE CASCADE,
  external_id TEXT,
  folder_path TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'archived',
        'deleted'
      )
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS
  knowledge_documents_source_external_id_uidx
  ON knowledge_documents (
    source_id,
    external_id
  )
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS knowledge_documents_workspace_idx
  ON knowledge_documents (
    workspace_id,
    status,
    imported_at DESC
  );

CREATE INDEX IF NOT EXISTS knowledge_documents_folder_idx
  ON knowledge_documents (
    workspace_id,
    folder_path
  );

CREATE INDEX IF NOT EXISTS knowledge_documents_content_hash_idx
  ON knowledge_documents (
    workspace_id,
    content_hash
  );

COMMIT;
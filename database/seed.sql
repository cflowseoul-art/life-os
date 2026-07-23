BEGIN;

INSERT INTO users (
  id,
  display_name
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  '연서'
)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  updated_at = now();

INSERT INTO households (
  id,
  name
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '우리 집'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = now();

INSERT INTO household_memberships (
  household_id,
  user_id,
  role
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'admin'
)
ON CONFLICT (household_id, user_id) DO UPDATE
SET
  role = EXCLUDED.role;

INSERT INTO workspaces (
  id,
  household_id,
  name,
  kind
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '공유 생활공간',
  'shared'
)
ON CONFLICT (id) DO UPDATE
SET
  household_id = EXCLUDED.household_id,
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  updated_at = now();


INSERT INTO products (
  id,
  canonical_name,
  base_unit
)
VALUES
(
  '44444444-4444-4444-8444-444444444444',
  '계란',
  '개'
),
(
  '55555555-5555-4555-8555-555555555555',
  '우유',
  '개'
)
ON CONFLICT (id) DO UPDATE
SET
  canonical_name = EXCLUDED.canonical_name,
  base_unit = EXCLUDED.base_unit,
  updated_at = now();


INSERT INTO product_aliases (
  alias,
  canonical_product_id
)
VALUES
(
  '계란',
  '44444444-4444-4444-8444-444444444444'
),
(
  '달걀',
  '44444444-4444-4444-8444-444444444444'
),
(
  '특란',
  '44444444-4444-4444-8444-444444444444'
),
(
  '우유',
  '55555555-5555-4555-8555-555555555555'
)
ON CONFLICT (alias) DO UPDATE
SET
  canonical_product_id = EXCLUDED.canonical_product_id;


INSERT INTO unit_conversions (
  canonical_product_id,
  from_unit,
  to_base_factor
)
VALUES
(
  '44444444-4444-4444-8444-444444444444',
  '판',
  30
),
(
  '55555555-5555-4555-8555-555555555555',
  '팩',
  1
)
ON CONFLICT (
  canonical_product_id,
  from_unit
)
DO UPDATE
SET
  to_base_factor = EXCLUDED.to_base_factor;

COMMIT;

SELECT
  u.id AS user_id,
  u.display_name,
  h.id AS household_id,
  h.name AS household_name,
  hm.role,
  w.id AS workspace_id,
  w.name AS workspace_name,
  w.kind
FROM users u
JOIN household_memberships hm
  ON hm.user_id = u.id
JOIN households h
  ON h.id = hm.household_id
JOIN workspaces w
  ON w.household_id = h.id
WHERE u.id = '11111111-1111-4111-8111-111111111111'
  AND w.id = '33333333-3333-4333-8333-333333333333';

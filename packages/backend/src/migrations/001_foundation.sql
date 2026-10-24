-- Área de importação fiel ao Firestore. Nenhuma rota usa esta tabela como fonte
-- de verdade até a conferência e ativação explícita da migração.
CREATE TABLE IF NOT EXISTS firestore_import (
  path text PRIMARY KEY,
  tenant_id text,
  payload jsonb NOT NULL,
  source_create_time text,
  source_update_time text,
  imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE firestore_import ADD COLUMN IF NOT EXISTS source_create_time text;
ALTER TABLE firestore_import ADD COLUMN IF NOT EXISTS source_update_time text;
CREATE INDEX IF NOT EXISTS firestore_import_tenant_path_idx ON firestore_import (tenant_id, path);

-- Primeira entidade operacional a sair do Firestore: histórico K-TAG.
CREATE TABLE IF NOT EXISTS tag_history (
  tenant_id text NOT NULL,
  id text NOT NULL,
  tag_id text NOT NULL,
  vehicle_id text,
  captured_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  payload jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS tag_history_lookup_idx ON tag_history (tenant_id, tag_id, captured_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS tag_history_retention_idx ON tag_history (saved_at);

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  enabled_modules text[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_users (
  tenant_id text NOT NULL,
  uid text NOT NULL,
  status text NOT NULL,
  role text NOT NULL,
  client_id text,
  custom_role_id text,
  payload jsonb NOT NULL,
  PRIMARY KEY (tenant_id, uid)
);
CREATE INDEX IF NOT EXISTS tenant_users_uid_idx ON tenant_users (uid);

CREATE TABLE IF NOT EXISTS custom_roles (
  tenant_id text NOT NULL,
  id text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS system_admins (
  uid text PRIMARY KEY,
  payload jsonb NOT NULL
);

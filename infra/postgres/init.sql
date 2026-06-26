-- K-Tag Manager — inicialização do PostgreSQL
-- Executado pelo Docker na primeira vez que o container é criado.

-- Banco dedicado para o Traccar.
-- O Traccar cria e gerencia seu próprio schema via Liquibase na Fase 3.
CREATE DATABASE traccar;
GRANT ALL PRIVILEGES ON DATABASE traccar TO ktag_user;

-- Extensões úteis no banco principal
\c ktag;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- busca por similaridade de texto

-- Schema para dados futuros do K-Tag (migração gradual do Firestore — Fase 5+)
-- Por ora, o K-Tag ainda usa Firebase Firestore como banco principal.
CREATE SCHEMA IF NOT EXISTS ktag;

-- Tabela de mapeamento K-Tag ↔ Traccar (usada na Fase 4)
-- Liga um veículo/ativo do K-Tag (Firestore ID) ao device correspondente no Traccar.
CREATE TABLE IF NOT EXISTS ktag.tracker_devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     TEXT NOT NULL,
  vehicle_id    TEXT NOT NULL,          -- ID do Firestore
  imei          TEXT NOT NULL UNIQUE,   -- IMEI/uniqueId do rastreador
  traccar_id    INTEGER,                -- ID do device no Traccar (preenchido na Fase 4)
  model         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | active | inactive
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracker_devices_tenant ON ktag.tracker_devices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tracker_devices_vehicle ON ktag.tracker_devices (tenant_id, vehicle_id);

COMMENT ON TABLE ktag.tracker_devices IS
  'Mapeamento entre veículos do K-Tag (Firestore) e devices do Traccar. '
  'Preenchido na Fase 4 da implementação do Traccar.';

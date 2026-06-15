-- Migrazione MANUALE e idempotente (eseguire con psql contro il DB target).
-- drizzle-kit push NON è affidabile sui cambi di PRIMARY KEY: usare questo file.
--
--   psql "$DIRECT_URL" -f drizzle/manual/0001_phase_and_advancer.sql
--
-- Copre:
--   #3  real_result.advancer_team_id  (chi-passa reale del knockout)
--   #4  prediction.phase + PK (user_id, match_id, phase)
-- Le righe esistenti di `prediction` diventano phase = 1.

BEGIN;

-- #3 — chi-passa reale (additivo, nullable; null per i Gironi)
ALTER TABLE real_result
    ADD COLUMN IF NOT EXISTS advancer_team_id text REFERENCES team (id);

-- #4 — fase del Pronostico + nuova PK composita
ALTER TABLE prediction
    ADD COLUMN IF NOT EXISTS phase integer NOT NULL DEFAULT 1;

ALTER TABLE prediction
    DROP CONSTRAINT IF EXISTS prediction_user_id_match_id_pk;
ALTER TABLE prediction
    DROP CONSTRAINT IF EXISTS prediction_user_id_match_id_phase_pk;
ALTER TABLE prediction
    ADD CONSTRAINT prediction_user_id_match_id_phase_pk
        PRIMARY KEY (user_id, match_id, phase);

COMMIT;

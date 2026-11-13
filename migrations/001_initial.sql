CREATE TABLE IF NOT EXISTS teams (
 id uuid PRIMARY KEY, public_registration_id text NOT NULL UNIQUE,
 normalized_team_name text NOT NULL, team_name text NOT NULL,
 status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','revoked')),
 access_hash text NOT NULL, idempotency_hash text NOT NULL UNIQUE, request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX active_team_name ON teams(normalized_team_name) WHERE status <> 'revoked';
CREATE TABLE participants (
 id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 position smallint NOT NULL CHECK(position BETWEEN 0 AND 2), full_name text NOT NULL,
 roll_number text NOT NULL, email text NOT NULL, phone text NOT NULL,
 academic_year smallint NOT NULL CHECK(academic_year BETWEEN 1 AND 3), branch text NOT NULL,
 is_team_leader boolean NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(team_id,position), CHECK(is_team_leader=(position=0))
);
CREATE UNIQUE INDEX active_roll_number ON participants(roll_number) WHERE active;
CREATE UNIQUE INDEX active_email ON participants(email) WHERE active;
CREATE TABLE registration_consents (
 id uuid PRIMARY KEY, team_id uuid NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
 terms_version text NOT NULL, privacy_version text NOT NULL, declarations jsonb NOT NULL,
 consent_timestamp timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tickets (
 id uuid PRIMARY KEY, team_id uuid NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
 verification_token_hash text NOT NULL UNIQUE, issued_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','revoked'))
);
CREATE TABLE admin_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','reviewer','checkin')), active boolean NOT NULL DEFAULT true
);
CREATE TABLE admin_sessions (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE check_ins (
 id uuid PRIMARY KEY, ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id),
 checked_in_at timestamptz NOT NULL DEFAULT now(), checked_in_by uuid NOT NULL REFERENCES admin_users(id)
);
CREATE TABLE registration_audit_events (
 id uuid PRIMARY KEY, team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
 action text NOT NULL, timestamp timestamptz NOT NULL DEFAULT now(), actor_type text NOT NULL, actor_id uuid
);
CREATE INDEX audit_team ON registration_audit_events(team_id,timestamp);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
-- Deferred invariant: every committed team must have exactly three member positions.
CREATE FUNCTION enforce_roster() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_NAME = 'teams' THEN target := NEW.id; ELSE target := COALESCE(NEW.team_id, OLD.team_id); END IF;
 IF EXISTS(SELECT 1 FROM teams WHERE id=target) AND (SELECT count(*) FROM participants WHERE team_id=target) <> 3 THEN
 RAISE EXCEPTION 'Team must have exactly three members' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME = 'participants' AND TG_OP = 'UPDATE' THEN
 IF OLD.team_id IS DISTINCT FROM NEW.team_id AND EXISTS(SELECT 1 FROM teams WHERE id=OLD.team_id)
 AND (SELECT count(*) FROM participants WHERE team_id=OLD.team_id) <> 3 THEN
 RAISE EXCEPTION 'Team must have exactly three members' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER team_roster AFTER INSERT OR UPDATE ON teams DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_roster();
CREATE CONSTRAINT TRIGGER member_roster AFTER INSERT OR UPDATE OR DELETE ON participants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_roster();

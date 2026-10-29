-- ============================================================
-- DBMS LEVEL 3 MINI PROJECT
-- SMART AIRSPACE CONFLICT ANALYSIS AND FLIGHT INTELLIGENCE SYSTEM
-- Team 12 | Class 5D
--
-- Students:
-- 1. Pranav Shashikiran Atreya - PES2UG24CS912
-- 2. Yash Raghavendra A        - PES2UG24CS913
--
-- PostgreSQL DDL executed for the project database.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(30) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE app_user (
    user_id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_user_role FOREIGN KEY (role_id) REFERENCES role(role_id)
);

CREATE TABLE aircraft (
    aircraft_id SERIAL PRIMARY KEY,
    registration_no VARCHAR(20) NOT NULL UNIQUE,
    aircraft_type VARCHAR(50) NOT NULL,
    model VARCHAR(80),
    operator_name VARCHAR(100),
    max_altitude_ft INTEGER,
    CONSTRAINT chk_aircraft_max_altitude CHECK (max_altitude_ft IS NULL OR max_altitude_ft >= 0)
);

CREATE TABLE airport (
    airport_id SERIAL PRIMARY KEY,
    iata_code VARCHAR(10) UNIQUE,
    icao_code VARCHAR(10) UNIQUE,
    airport_name VARCHAR(150) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    latitude NUMERIC(8,5),
    longitude NUMERIC(8,5),
    CONSTRAINT chk_airport_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_airport_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE flight (
    flight_id SERIAL PRIMARY KEY,
    flight_number VARCHAR(20) NOT NULL,
    aircraft_id INTEGER NOT NULL,
    departure_airport INTEGER NOT NULL,
    arrival_airport INTEGER NOT NULL,
    scheduled_departure TIMESTAMP NOT NULL,
    scheduled_arrival TIMESTAMP NOT NULL,
    actual_departure TIMESTAMP,
    actual_arrival TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    CONSTRAINT fk_flight_aircraft FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id),
    CONSTRAINT fk_flight_departure_airport FOREIGN KEY (departure_airport) REFERENCES airport(airport_id),
    CONSTRAINT fk_flight_arrival_airport FOREIGN KEY (arrival_airport) REFERENCES airport(airport_id),
    CONSTRAINT chk_flight_status CHECK (status IN ('SCHEDULED','ACTIVE','COMPLETED','CANCELLED')),
    CONSTRAINT chk_flight_scheduled_times CHECK (scheduled_arrival > scheduled_departure),
    CONSTRAINT chk_flight_actual_times CHECK (actual_arrival IS NULL OR actual_departure IS NULL OR actual_arrival > actual_departure)
);

CREATE TABLE waypoint (
    waypoint_id SERIAL PRIMARY KEY,
    waypoint_code VARCHAR(30) NOT NULL UNIQUE,
    latitude NUMERIC(8,5) NOT NULL,
    longitude NUMERIC(8,5) NOT NULL,
    CONSTRAINT chk_waypoint_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_waypoint_longitude CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE flight_waypoint (
    flight_id INTEGER NOT NULL,
    waypoint_id INTEGER NOT NULL,
    sequence_no INTEGER NOT NULL,
    planned_altitude_ft INTEGER NOT NULL,
    CONSTRAINT pk_flight_waypoint PRIMARY KEY (flight_id, waypoint_id),
    CONSTRAINT fk_flight_waypoint_flight FOREIGN KEY (flight_id) REFERENCES flight(flight_id) ON DELETE CASCADE,
    CONSTRAINT fk_flight_waypoint_waypoint FOREIGN KEY (waypoint_id) REFERENCES waypoint(waypoint_id),
    CONSTRAINT chk_flight_waypoint_sequence CHECK (sequence_no > 0),
    CONSTRAINT chk_flight_waypoint_altitude CHECK (planned_altitude_ft >= 0),
    CONSTRAINT uq_flight_waypoint_sequence UNIQUE (flight_id, sequence_no)
);

CREATE TABLE flight_position (
    position_id SERIAL PRIMARY KEY,
    flight_id INTEGER NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    latitude NUMERIC(8,5) NOT NULL,
    longitude NUMERIC(8,5) NOT NULL,
    altitude_ft INTEGER NOT NULL,
    ground_speed_kts NUMERIC(7,2),
    heading_deg NUMERIC(6,2),
    CONSTRAINT fk_flight_position_flight FOREIGN KEY (flight_id) REFERENCES flight(flight_id) ON DELETE CASCADE,
    CONSTRAINT chk_position_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_position_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_position_altitude CHECK (altitude_ft >= 0),
    CONSTRAINT chk_position_speed CHECK (ground_speed_kts IS NULL OR ground_speed_kts >= 0),
    CONSTRAINT chk_position_heading CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360)
);

CREATE TABLE restricted_airspace (
    airspace_id SERIAL PRIMARY KEY,
    airspace_code VARCHAR(30) NOT NULL UNIQUE,
    airspace_name VARCHAR(150) NOT NULL,
    restriction_type VARCHAR(30) NOT NULL,
    center_latitude NUMERIC(8,5) NOT NULL,
    center_longitude NUMERIC(8,5) NOT NULL,
    radius_nm NUMERIC(8,2) NOT NULL,
    lower_altitude_ft INTEGER NOT NULL,
    upper_altitude_ft INTEGER NOT NULL,
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP NOT NULL,
    CONSTRAINT chk_airspace_latitude CHECK (center_latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_airspace_longitude CHECK (center_longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_airspace_radius CHECK (radius_nm > 0),
    CONSTRAINT chk_airspace_altitude_range CHECK (upper_altitude_ft >= lower_altitude_ft),
    CONSTRAINT chk_airspace_validity CHECK (valid_to > valid_from),
    CONSTRAINT chk_airspace_restriction_type CHECK (restriction_type IN ('RESTRICTED','PROHIBITED','DANGER'))
);

CREATE TABLE notam (
    notam_id SERIAL PRIMARY KEY,
    notam_number VARCHAR(50) NOT NULL UNIQUE,
    airspace_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    notam_text TEXT NOT NULL,
    issued_at TIMESTAMP NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP NOT NULL,
    CONSTRAINT fk_notam_airspace FOREIGN KEY (airspace_id) REFERENCES restricted_airspace(airspace_id),
    CONSTRAINT chk_notam_validity CHECK (effective_to > effective_from)
);

CREATE TABLE incident (
    incident_id SERIAL PRIMARY KEY,
    flight_id INTEGER NOT NULL,
    incident_type VARCHAR(40) NOT NULL,
    incident_title VARCHAR(200) NOT NULL,
    description TEXT,
    occurred_at TIMESTAMP NOT NULL,
    severity VARCHAR(20) NOT NULL,
    CONSTRAINT fk_incident_flight FOREIGN KEY (flight_id) REFERENCES flight(flight_id),
    CONSTRAINT chk_incident_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);

CREATE TABLE conflict_event (
    conflict_id SERIAL PRIMARY KEY,
    primary_flight_id INTEGER NOT NULL,
    secondary_flight_id INTEGER,
    airspace_id INTEGER,
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conflict_type VARCHAR(40) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT,
    minimum_distance_nm NUMERIC(8,3),
    altitude_difference_ft INTEGER,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP,
    CONSTRAINT fk_conflict_primary_flight FOREIGN KEY (primary_flight_id) REFERENCES flight(flight_id),
    CONSTRAINT fk_conflict_secondary_flight FOREIGN KEY (secondary_flight_id) REFERENCES flight(flight_id),
    CONSTRAINT fk_conflict_airspace FOREIGN KEY (airspace_id) REFERENCES restricted_airspace(airspace_id),
    CONSTRAINT chk_conflict_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_conflict_distance CHECK (minimum_distance_nm IS NULL OR minimum_distance_nm >= 0),
    CONSTRAINT chk_conflict_altitude_difference CHECK (altitude_difference_ft IS NULL OR altitude_difference_ft >= 0),
    CONSTRAINT chk_conflict_distinct_flights CHECK (secondary_flight_id IS NULL OR primary_flight_id <> secondary_flight_id),
    CONSTRAINT chk_conflict_resolution CHECK ((resolved = FALSE AND resolved_at IS NULL) OR (resolved = TRUE AND resolved_at IS NOT NULL))
);

ALTER TABLE notam
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE notam
ADD CONSTRAINT chk_notam_status CHECK (status IN ('ACTIVE','EXPIRED'));

ALTER TABLE notam
ADD COLUMN embedding VECTOR(384);

ALTER TABLE incident
ADD COLUMN embedding VECTOR(384);

CREATE INDEX idx_app_user_role ON app_user(role_id);
CREATE INDEX idx_flight_aircraft ON flight(aircraft_id);
CREATE INDEX idx_flight_departure_airport ON flight(departure_airport);
CREATE INDEX idx_flight_arrival_airport ON flight(arrival_airport);
CREATE INDEX idx_flight_status ON flight(status);
CREATE INDEX idx_flight_scheduled_departure ON flight(scheduled_departure);
CREATE INDEX idx_flight_waypoint_flight ON flight_waypoint(flight_id);
CREATE INDEX idx_flight_position_flight ON flight_position(flight_id);
CREATE INDEX idx_flight_position_recorded_at ON flight_position(recorded_at);
CREATE INDEX idx_restricted_airspace_type ON restricted_airspace(restriction_type);
CREATE INDEX idx_notam_airspace ON notam(airspace_id);
CREATE INDEX idx_notam_status ON notam(status);
CREATE INDEX idx_incident_flight ON incident(flight_id);
CREATE INDEX idx_incident_severity ON incident(severity);
CREATE INDEX idx_conflict_primary_flight ON conflict_event(primary_flight_id);
CREATE INDEX idx_conflict_secondary_flight ON conflict_event(secondary_flight_id);
CREATE INDEX idx_conflict_airspace ON conflict_event(airspace_id);
CREATE INDEX idx_conflict_severity ON conflict_event(severity);
CREATE INDEX idx_conflict_resolution ON conflict_event(resolved);

CREATE INDEX idx_notam_embedding_hnsw
ON notam
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_incident_embedding_hnsw
ON incident
USING hnsw (embedding vector_cosine_ops);

CREATE VIEW active_flight_summary AS
SELECT
    f.flight_id,
    f.flight_number,
    ac.registration_no,
    ac.aircraft_type,
    dep.icao_code AS departure_airport,
    arr.icao_code AS arrival_airport,
    f.scheduled_departure,
    f.scheduled_arrival,
    f.status
FROM flight f
JOIN aircraft ac ON f.aircraft_id = ac.aircraft_id
JOIN airport dep ON f.departure_airport = dep.airport_id
JOIN airport arr ON f.arrival_airport = arr.airport_id
WHERE f.status IN ('SCHEDULED','ACTIVE');

-- Temporary DDL demonstration of ALTER + DROP used for the DDL evidence.
CREATE TABLE ddl_demo (
    demo_id SERIAL PRIMARY KEY,
    demo_value VARCHAR(50)
);

ALTER TABLE ddl_demo
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DROP TABLE ddl_demo;

-- PROJECT REPRODUCIBILITY ADDITIONS: METADATA AND ADVANCED ROUTINES


-- ============================================================
-- PROJECT REPRODUCIBILITY ADDITIONS: METADATA AND ADVANCED ROUTINES
-- ============================================================

-- Record which embedding model generated each stored vector.
ALTER TABLE notam
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);

ALTER TABLE notam
    ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP;

ALTER TABLE incident
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);

ALTER TABLE incident
    ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP;


-- Resolve a conflict and record the resolution timestamp.
CREATE OR REPLACE FUNCTION public.resolve_conflict(
    p_conflict_id INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE conflict_event
    SET
        resolved = TRUE,
        resolved_at = CURRENT_TIMESTAMP
    WHERE conflict_id = p_conflict_id;

    IF NOT FOUND THEN
        RETURN 'Conflict not found';
    END IF;

    RETURN 'Conflict resolved successfully';
END;
$function$;


-- Maintain resolution timestamp consistency during updates.
CREATE OR REPLACE FUNCTION public.set_conflict_resolution_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.resolved = TRUE AND OLD.resolved = FALSE THEN
        NEW.resolved_at = CURRENT_TIMESTAMP;
    ELSIF NEW.resolved = FALSE THEN
        NEW.resolved_at = NULL;
    END IF;

    RETURN NEW;
END;
$function$;


-- Recreate the trigger so this section is repeatable.
DROP TRIGGER IF EXISTS trg_conflict_resolution
ON conflict_event;

CREATE TRIGGER trg_conflict_resolution
BEFORE UPDATE ON conflict_event
FOR EACH ROW
EXECUTE FUNCTION public.set_conflict_resolution_time();

-- End of project reproducibility additions.

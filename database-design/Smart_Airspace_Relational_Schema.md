# Smart Airspace Conflict Analysis and Flight Intelligence System

## Relational schema and data dictionary

**Database platform:** PostgreSQL with the pgvector extension  
**Embedding model:** Xenova/all-MiniLM-L6-v2  
**Embedding dimensions:** 384  
**Similarity strategy:** Cosine distance using pgvector's `<=>` operator; HNSW cosine indexes support vector retrieval.

The schema below describes the project tables, primary keys, foreign keys and key integrity rules. Confirm any change to the actual DDL before using this file as evidence of the implemented database.

## 1. Relations

### `role`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `role_id` | `SERIAL` | PK |
| `role_name` | `VARCHAR(30)` | NOT NULL, UNIQUE |
| `description` | `TEXT` | NULL |

### `app_user`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `user_id` | `SERIAL` | PK |
| `role_id` | `INTEGER` | FK → role.role_id |
| `full_name` | `VARCHAR(100)` | NOT NULL |
| `email` | `VARCHAR(150)` | NOT NULL, UNIQUE |
| `password_hash` | `VARCHAR(255)` | NOT NULL |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT TRUE |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### `aircraft`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `aircraft_id` | `SERIAL` | PK |
| `registration_no` | `VARCHAR(20)` | NOT NULL, UNIQUE |
| `aircraft_type` | `VARCHAR(50)` | NOT NULL |
| `model` | `VARCHAR(80)` | NULL |
| `operator_name` | `VARCHAR(100)` | NULL |
| `max_altitude_ft` | `INTEGER` | CHECK >= 0 when supplied |

### `flight`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `flight_id` | `SERIAL` | PK |
| `flight_number` | `VARCHAR(20)` | NOT NULL |
| `aircraft_id` | `INTEGER` | FK → aircraft.aircraft_id |
| `departure_airport` | `INTEGER` | FK → airport.airport_id |
| `arrival_airport` | `INTEGER` | FK → airport.airport_id |
| `scheduled_departure` | `TIMESTAMP` | NOT NULL |
| `scheduled_arrival` | `TIMESTAMP` | NOT NULL, after departure |
| `actual_departure` | `TIMESTAMP` | NULL |
| `actual_arrival` | `TIMESTAMP` | NULL |
| `status` | `VARCHAR(20)` | SCHEDULED / ACTIVE / COMPLETED / CANCELLED |

### `airport`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `airport_id` | `SERIAL` | PK |
| `iata_code` | `VARCHAR(10)` | UNIQUE |
| `icao_code` | `VARCHAR(10)` | UNIQUE |
| `airport_name` | `VARCHAR(150)` | NOT NULL |
| `city` | `VARCHAR(100)` | NULL |
| `country` | `VARCHAR(100)` | NULL |
| `latitude` | `NUMERIC(8,5)` | CHECK -90 to 90 when supplied |
| `longitude` | `NUMERIC(8,5)` | CHECK -180 to 180 when supplied |

### `waypoint`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `waypoint_id` | `SERIAL` | PK |
| `waypoint_code` | `VARCHAR(30)` | NOT NULL, UNIQUE |
| `latitude` | `NUMERIC(8,5)` | NOT NULL, CHECK -90 to 90 |
| `longitude` | `NUMERIC(8,5)` | NOT NULL, CHECK -180 to 180 |

### `flight_waypoint`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `flight_id` | `INTEGER` | PK, FK → flight; ON DELETE CASCADE |
| `waypoint_id` | `INTEGER` | PK, FK → waypoint |
| `sequence_no` | `INTEGER` | NOT NULL, UNIQUE per flight, > 0 |
| `planned_altitude_ft` | `INTEGER` | NOT NULL, >= 0 |

### `flight_position`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `position_id` | `SERIAL` | PK |
| `flight_id` | `INTEGER` | FK → flight.flight_id |
| `recorded_at` | `TIMESTAMP` | NOT NULL |
| `latitude` | `NUMERIC(8,5)` | NOT NULL, CHECK -90 to 90 |
| `longitude` | `NUMERIC(8,5)` | NOT NULL, CHECK -180 to 180 |
| `altitude_ft` | `INTEGER` | NOT NULL, >= 0 |
| `ground_speed_kts` | `NUMERIC(7,2)` | NULL, >= 0 |
| `heading_deg` | `NUMERIC(6,2)` | NULL, 0 to 360 |

### `restricted_airspace`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `airspace_id` | `SERIAL` | PK |
| `airspace_code` | `VARCHAR(30)` | NOT NULL, UNIQUE |
| `airspace_name` | `VARCHAR(150)` | NOT NULL |
| `restriction_type` | `VARCHAR(30)` | RESTRICTED / PROHIBITED / DANGER |
| `center_latitude` | `NUMERIC(8,5)` | NOT NULL, valid latitude |
| `center_longitude` | `NUMERIC(8,5)` | NOT NULL, valid longitude |
| `radius_nm` | `NUMERIC(8,2)` | NOT NULL, > 0 |
| `lower_altitude_ft` | `INTEGER` | NOT NULL |
| `upper_altitude_ft` | `INTEGER` | NOT NULL, >= lower altitude |
| `valid_from` | `TIMESTAMP` | NOT NULL |
| `valid_to` | `TIMESTAMP` | NOT NULL, after valid_from |

### `notam`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `notam_id` | `SERIAL` | PK |
| `notam_number` | `VARCHAR(50)` | NOT NULL, UNIQUE |
| `airspace_id` | `INTEGER` | FK → restricted_airspace |
| `title` | `VARCHAR(200)` | NOT NULL |
| `notam_text` | `TEXT` | NOT NULL |
| `issued_at` | `TIMESTAMP` | NOT NULL |
| `effective_from` | `TIMESTAMP` | NOT NULL |
| `effective_to` | `TIMESTAMP` | NOT NULL, after effective_from |
| `status` | `VARCHAR(20)` | ACTIVE / EXPIRED |
| `embedding` | `VECTOR(384)` | pgvector embedding, nullable |
| `embedding_model` | `VARCHAR(100)` | Model metadata, nullable |
| `embedding_generated_at` | `TIMESTAMP` | Generation timestamp, nullable |

### `incident`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `incident_id` | `SERIAL` | PK |
| `flight_id` | `INTEGER` | FK → flight.flight_id |
| `incident_type` | `VARCHAR(40)` | NOT NULL |
| `incident_title` | `VARCHAR(200)` | NOT NULL |
| `description` | `TEXT` | NULL |
| `occurred_at` | `TIMESTAMP` | NOT NULL |
| `severity` | `VARCHAR(20)` | LOW / MEDIUM / HIGH / CRITICAL |
| `embedding` | `VECTOR(384)` | pgvector embedding, nullable |
| `embedding_model` | `VARCHAR(100)` | Model metadata, nullable |
| `embedding_generated_at` | `TIMESTAMP` | Generation timestamp, nullable |

### `conflict_event`

| Attribute | Type | Key / integrity rule |
|---|---|---|
| `conflict_id` | `SERIAL` | PK |
| `primary_flight_id` | `INTEGER` | FK → flight.flight_id |
| `secondary_flight_id` | `INTEGER` | Nullable FK → flight.flight_id |
| `airspace_id` | `INTEGER` | Nullable FK → restricted_airspace |
| `detected_at` | `TIMESTAMP` | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `conflict_type` | `VARCHAR(40)` | NOT NULL |
| `severity` | `VARCHAR(20)` | LOW / MEDIUM / HIGH / CRITICAL |
| `description` | `TEXT` | NULL |
| `minimum_distance_nm` | `NUMERIC(8,3)` | NULL, >= 0 |
| `altitude_difference_ft` | `INTEGER` | NULL, >= 0 |
| `resolved` | `BOOLEAN` | NOT NULL, DEFAULT FALSE |
| `resolved_at` | `TIMESTAMP` | NULL; maintained by trigger |


## 2. Relationships and cardinality

| Parent relation | Child relation | Foreign key | Meaning |
|---|---|---|---|
| `role` | `app_user` | `app_user.role_id` | A role can be assigned to multiple users. |
| `aircraft` | `flight` | `flight.aircraft_id` | An aircraft can operate multiple flights. |
| `airport` | `flight` | `departure_airport` | An airport can be the departure location for multiple flights. |
| `airport` | `flight` | `arrival_airport` | An airport can be the arrival location for multiple flights. |
| `flight` | `flight_waypoint` | `flight_waypoint.flight_id` | A flight can contain multiple ordered route entries. |
| `waypoint` | `flight_waypoint` | `flight_waypoint.waypoint_id` | A waypoint can be referenced by multiple route entries. |
| `flight` | `flight_position` | `flight_position.flight_id` | A flight can have multiple recorded positions. |
| `restricted_airspace` | `notam` | `notam.airspace_id` | An airspace can be associated with multiple notices. |
| `flight` | `incident` | `incident.flight_id` | A flight can have multiple incidents. |
| `flight` | `conflict_event` | `primary_flight_id` | A flight may be the primary flight in multiple conflict events. |
| `flight` | `conflict_event` | `secondary_flight_id` | A flight may be the secondary flight in multiple conflict events. This relationship is optional. |
| `restricted_airspace` | `conflict_event` | `conflict_event.airspace_id` | An airspace can be linked to multiple conflict events. This relationship is optional on a conflict. |

## 3. Important database constraints

- Primary keys identify individual records. `flight_waypoint` uses a composite primary key of `(flight_id, waypoint_id)`.
- Foreign keys preserve references between operational records.
- Unique constraints apply to identifiers such as role names, user emails, aircraft registrations, airport codes, waypoint codes, airspace codes and NOTAM numbers.
- CHECK constraints validate flight states and times, geographic coordinates, altitude and speed ranges, airspace validity and severity values.
- The conflict resolution trigger maintains consistency between `resolved` and `resolved_at`.
- The `active_flight_summary` view joins flights to aircraft and departure/arrival airports.
- The two HNSW vector indexes use cosine-distance operations for NOTAM and incident semantic retrieval.

## 4. Vector data model and retrieval

Text from NOTAMs and incident descriptions is transformed into 384-dimensional embeddings by `Xenova/all-MiniLM-L6-v2`. Vectors are stored in the PostgreSQL `VECTOR(384)` columns. The corresponding model name and embedding-generation timestamp are stored as metadata. Semantic queries are embedded with the same model and ranked by cosine distance.

## 5. Advanced database objects

| Object | Purpose |
|---|---|
| `active_flight_summary` | Joins flight, aircraft and airport data for the UI. |
| `resolve_conflict(p_conflict_id)` | Marks a conflict resolved and records its timestamp. |
| `set_conflict_resolution_time()` | Trigger function to maintain resolution timestamps on updates. |
| `trg_conflict_resolution` | Runs before updates to `conflict_event`. |
| Conventional B-tree indexes | Support frequently used joins, status filters and lookups. |
| HNSW cosine indexes | Support approximate nearest-neighbour vector search on NOTAM and incident embeddings. |

## 6. Diagram files

- `Smart_Airspace_ER_Diagram.drawio`: editable ER diagram.
- `Smart_Airspace_ER_Diagram.mmd`: Mermaid ER diagram source.

These design artifacts are generated from the project's submitted DDL and documented implementation; verify changes against `12_DDL.sql` if the schema is modified later.

# Smart Airspace Conflict Analysis and Flight Intelligence System
## Business Rules and Data Contract

**Course:** DBMS Level 3 Experiential Learning  
**Team:** 12 · Class 5D  
**Database platform:** PostgreSQL with pgvector

**Team members**
- Pranav Shashikiran Atreya — PES2UG24CS912
- Yash Raghavendra A — PES2UG24CS913

## 1. Purpose

This document specifies the core entities, input rules, relationships, validation expectations and application permissions for the Smart Airspace Conflict Analysis and Flight Intelligence System.

The database schema remains the authoritative source for constraints. Application-level validation and access control complement, rather than replace, database constraints.

## 2. Data ownership and entities

| Entity | Purpose | Important relationships |
|---|---|---|
| role | Defines application roles | Referenced by app_user |
| app_user | Stores account identity and password hash | References role |
| aircraft | Stores aircraft registration and characteristics | Referenced by flight |
| airport | Stores airport codes and location | Referenced as departure and arrival airport by flight |
| flight | Stores flight schedule, aircraft and status | References aircraft and two airports |
| waypoint | Stores route coordinates | Referenced by flight_waypoint |
| flight_waypoint | Associates flights with ordered route waypoints | Composite key of flight_id and waypoint_id |
| flight_position | Stores recorded flight coordinates and altitude | References flight |
| restricted_airspace | Defines a circular restricted region, altitude interval and validity window | Referenced by NOTAM and conflict events |
| notam | Stores aviation notices and optional semantic vectors | References restricted_airspace |
| incident | Stores flight-related incidents and optional semantic vectors | References flight |
| conflict_event | Stores detected conflicts and resolution status | References primary flight, optional secondary flight and optional airspace |

## 3. Identity and authentication rules

1. Each user must have a primary key and a role reference.
2. User email addresses must be unique and non-null.
3. Passwords must be stored as hashes, not plaintext.
4. Only active accounts may use protected functionality.
5. Application roles are ADMIN and OPERATOR.
6. Authentication uses a signed session token carried in an HTTP-only cookie.
7. The session lifetime is eight hours.
8. Session signing secrets and database passwords must be supplied through environment variables, not hard-coded into source files.

## 4. Flight and route rules

1. Every flight references an existing aircraft, departure airport and arrival airport.
2. A flight status must be one of SCHEDULED, ACTIVE, COMPLETED or CANCELLED.
3. Scheduled arrival must be later than scheduled departure.
4. If both actual departure and actual arrival exist, actual arrival must be later than actual departure.
5. Aircraft registrations are unique.
6. Airport IATA and ICAO codes, when provided, are individually unique.
7. Airport coordinates, when provided, must be within latitude and longitude bounds.
8. Waypoint coordinates must be valid geographic coordinates.
9. Flight waypoint sequence numbers must be positive and unique within a flight.
10. The flight_waypoint relationship has a composite primary key on flight_id and waypoint_id.
11. Deleting a flight cascades to its flight_waypoint and flight_position records as declared in the DDL.

## 5. Recorded position rules

1. Every position belongs to an existing flight.
2. The recording timestamp, latitude, longitude and altitude must be provided.
3. Latitude must be between -90 and 90 degrees.
4. Longitude must be between -180 and 180 degrees.
5. Altitude must be non-negative.
6. Ground speed, when supplied, must be non-negative.
7. Heading, when supplied, must be between 0 and 360 degrees.

## 6. Restricted-airspace rules

1. Every airspace has a unique code and a required name.
2. Restriction type must be RESTRICTED, PROHIBITED or DANGER.
3. The center coordinates must be valid geographic coordinates.
4. Radius must be greater than zero.
5. Upper altitude must be greater than or equal to lower altitude.
6. The validity end time must be later than the validity start time.
7. Airspace records referenced by NOTAMs and conflict events must exist.
8. Application validation and database CHECK constraints should both reject invalid coordinates, radii, altitude intervals and validity periods.

## 7. NOTAM rules

1. Each NOTAM has a unique notice number and references an existing restricted airspace.
2. Title, notice text, issue timestamp and effective time interval are required.
3. The effective end time must be later than the effective start time.
4. Status must be ACTIVE or EXPIRED.
5. A stored embedding, when present, must use the VECTOR(384) type.
6. Embedding model name and generation timestamp describe how and when the stored vector was produced.
7. The model metadata may be absent when a vector has not been generated or the metadata has not been recorded.

## 8. Incident rules

1. Each incident references an existing flight.
2. Incident type, title, occurrence timestamp and severity are required.
3. Severity must be LOW, MEDIUM, HIGH or CRITICAL.
4. Incident descriptions may be used for semantic search.
5. Stored incident vectors use VECTOR(384), with optional embedding-model and generation-time metadata.

## 9. Conflict-event rules

1. Every conflict has a primary flight reference.
2. Secondary flight and associated airspace references are optional.
3. If a secondary flight is present, it must differ from the primary flight.
4. Severity must be LOW, MEDIUM, HIGH or CRITICAL.
5. Minimum distance, when present, must be non-negative.
6. Altitude difference, when present, must be non-negative.
7. A new conflict defaults to unresolved.
8. An unresolved conflict must have a null resolution timestamp.
9. A resolved conflict must have a resolution timestamp.
10. The trigger function set_conflict_resolution_time maintains the timestamp as a conflict's resolution state changes.
11. The resolve_conflict function resolves a specified conflict and returns a status message if the record cannot be found or is successfully resolved.

## 10. Conflict analysis behaviour

The implemented analyzer is a rule-based academic demonstration:

1. Recorded flight positions are checked against restricted-airspace center coordinates and radius.
2. Altitude bands and airspace validity periods are considered when evaluating restricted-airspace entry.
3. Position records from different flights are also compared for proximity conflicts.
4. The implementation uses a temporal matching window of five minutes, a horizontal separation threshold of five nautical miles and a vertical separation threshold of 1,000 feet for the proximity check.
5. Conflict events are inserted only when the implementation determines that the corresponding event has not already been recorded.
6. The analyzer reports the records it checked and the events it inserted.

These rules are intended for project demonstration and must not be interpreted as certified aviation safety logic.

## 11. Access-control contract

| Operation | ADMIN | OPERATOR |
|---|---|---|
| Sign in and use permitted application functions | Yes | Yes |
| View dashboard and flight records | Yes | Yes |
| Create, update and delete flights | Yes | No |
| View restricted-airspace records | Yes | Yes |
| Create, update and delete restricted-airspace records | Yes | No |
| Run conflict analysis | Yes | Yes |
| Search NOTAM and incident records semantically | Yes | Yes |
| Access user-administration API | Yes | No |

Protected API routes must verify the authenticated account and its current database role. Hiding a user-interface control alone is not sufficient authorization.

## 12. Vector-search contract

| Property | Specification |
|---|---|
| Structured database | PostgreSQL |
| Vector extension | pgvector |
| Text sources | NOTAM and incident records |
| Embedding model | Xenova/all-MiniLM-L6-v2 |
| Vector size | 384 dimensions |
| Similarity method | Cosine distance |
| SQL operator | pgvector cosine-distance operator, <=> |
| Indexing | HNSW cosine indexes on NOTAM and incident embeddings |
| Metadata | Embedding model and generation timestamp |
| Retrieval | Embed the search query with the same model, compare vectors and return ranked records |

Embeddings and metadata are supplementary representations; the original notice and incident text remains the source content.

## 13. Data validation and integrity responsibilities

- The user interface should give meaningful validation feedback.
- API handlers should validate client input before performing database writes.
- Database primary keys, unique constraints, foreign keys and CHECK constraints provide a second integrity layer.
- Database transactions should be used for multi-step operations that must succeed or fail together.
- User-provided values should be passed through parameterized queries, not concatenated into SQL.
- Password hashes, authentication secrets and database credentials must never be exposed through API responses.
- Database errors should be logged on the server without exposing sensitive implementation details to end users.

## 14. Important database objects

| Object | Responsibility |
|---|---|
| active_flight_summary view | Joins flight, aircraft, and departure/arrival airport details |
| resolve_conflict | Marks a conflict resolved and returns an operation result |
| set_conflict_resolution_time | Maintains conflict-resolution timestamps |
| trg_conflict_resolution | Calls the resolution timestamp function before conflict-event updates |
| HNSW vector indexes | Support approximate nearest-neighbour retrieval by cosine distance |
| Conventional indexes | Support common relational joins, status filters and lookups |

## 15. Supporting files

- ../12_DDL.sql — schema and advanced database objects
- ../smart_airspace_db_backup_2026-10-26.dump — supplied demonstration database backup
- Smart_Airspace_ER_Diagram.drawio — editable entity-relationship diagram
- Smart_Airspace_ER_Diagram.mmd — Mermaid diagram source
- Smart_Airspace_Relational_Schema.md — schema and data dictionary
- ../smart-airspace-app/final_sql_demonstrations.sql — SQL demonstration queries

## 16. Known project limitations

1. The project is a rule-based academic demonstration and does not use certified live aviation surveillance data.
2. Dashboard notifications depend on refreshed dashboard data rather than a real-time push service.
3. Demonstration records should not be treated as actual operational flight telemetry.
4. Authentication sessions expire after the configured eight-hour duration.
5. Recreating the database from schema-only DDL does not reproduce the populated demonstration dataset; the supplied backup is intended for that purpose.

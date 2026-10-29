# Smart Airspace Conflict Analysis and Flight Intelligence System

DBMS Level 3 Experiential Learning Mini-Project
Team 12 · Class 5D

Team members:
- Pranav Shashikiran Atreya — PES2UG24CS912
- Yash Raghavendra A — PES2UG24CS913

## 1. Project overview

This project demonstrates a database-backed flight intelligence system that manages flight information, aircraft, airports, flight positions, restricted airspace, NOTAMs, incidents and conflict events.

The system goes beyond basic CRUD through rule-based conflict analysis, relational joins and aggregations, transactional operations, trigger-maintained consistency and vector similarity search over text-heavy aviation records.

The application uses PostgreSQL for structured operational data and PostgreSQL with pgvector for vector storage and semantic retrieval.

## 2. Technology stack

- Frontend: Next.js and React
- Backend: Next.js API route handlers
- Database: PostgreSQL
- Vector extension: pgvector
- Embedding model: Xenova/all-MiniLM-L6-v2
- Embedding dimensions: 384
- Database client: node-postgres (pg)
- Authentication: bcryptjs password verification and signed JWT sessions
- Validation: Zod
- Language: TypeScript and JavaScript

## 3. Main functionality

- Dashboard with flight, airspace and conflict summaries
- Authentication with ADMIN and OPERATOR roles
- Flight management with administrative write permissions
- Restricted-airspace management with administrative write permissions
- Conflict-event listing and rule-based conflict analysis
- NOTAM and incident semantic search
- Database status, schema diagnostics and vector embedding coverage
- Analytics backed by SQL aggregate queries
- Notification dropdown for recent unresolved conflicts
- SQL demonstration queries and database design artifacts

Notifications are based on dashboard data. The dashboard must refresh its data before newly detected conflicts appear; this implementation does not provide real-time push alerts.

## 4. Database design

The project schema contains these 12 primary tables:

1. role
2. app_user
3. aircraft
4. airport
5. flight
6. waypoint
7. flight_waypoint
8. flight_position
9. restricted_airspace
10. notam
11. incident
12. conflict_event

Additional database objects include the active_flight_summary view, project-defined functions and a conflict-resolution trigger. Conventional indexes support operational access patterns, while HNSW cosine indexes support vector retrieval.

The database-design directory contains:
- Smart_Airspace_ER_Diagram.drawio — editable diagram
- Smart_Airspace_ER_Diagram.mmd — Mermaid source
- Smart_Airspace_Relational_Schema.md — relational schema and data dictionary
- Smart_Airspace_Business_Rules_Data_Contract.md — business rules and input/data contract

## 5. Prerequisites

- Node.js 20.9 or later; a current LTS release is recommended.
- npm
- PostgreSQL with the pgvector extension available
- A PostgreSQL user permitted to create or restore the project database
- Internet access when downloading model files for a fresh embedding-generation run

## 6. Install dependencies

Open PowerShell in the smart-airspace-app directory and run:

    npm ci

## 7. Configure the environment

Copy the example configuration to the local environment file:

    Copy-Item .env.example .env.local

Edit .env.local with the correct PostgreSQL password and a private authentication secret. Do not commit .env.local or share its values.

The application uses these variables:

- PGHOST — PostgreSQL host
- PGPORT — PostgreSQL port
- PGDATABASE — database name
- PGUSER — database login
- PGPASSWORD — database password
- AUTH_SECRET — secret used to sign and verify session tokens

AUTH_SECRET must contain at least 32 characters. Generate a strong random secret with:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

The generated value is local configuration and should not be published.

## 8. Restore the supplied database backup

The populated demonstration backup is distributed separately through the private team handoff. It is excluded from Git because it contains database records and password hashes. For the restore command below, place a private copy named `smart_airspace_db_backup_2026-10-26.dump` in the repository root, or substitute the actual full path to your local copy.

For the existing demonstration dataset, use a fresh, empty database. Do not restore into a database containing project tables.

Create the database if it does not already exist:

    & "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -h localhost -p 5432 smart_airspace_db

Restore the backup:

    & "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost -p 5432 --no-owner --no-privileges -d smart_airspace_db "smart_airspace_db_backup_2026-10-26.dump"

Use the PGDATABASE value corresponding to the database you restored.

Alternative: the schema-only DDL is available as database/12_DDL.sql. To create an empty schema rather than restore the supplied dataset, create an empty database and execute:

    & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -v ON_ERROR_STOP=1 -U postgres -h localhost -p 5432 -d smart_airspace_db -f "database/12_DDL.sql"

The DDL creates the schema and database objects; it does not populate the full demonstration dataset. Do not run the full DDL on top of a restored database.

## 9. Run the application

Start the development server:

    npm run dev

Open http://localhost:3000 in a browser and sign in with an active project account.

For a production build:

    npm run build

Start the production server after a successful build:

    npm run start

Run ESLint checks:

    npm run lint

## 10. Main application pages

- / — Flight intelligence dashboard
- /login — Sign-in page
- /flights — Flight management
- /airspaces — Restricted-airspace management
- /conflicts — Conflict event records
- /intelligence — Semantic aviation search
- /database — Database status and vector diagnostics
- /analytics — SQL-backed analytics

API endpoints provide authentication, database health, dashboard summaries, flight and airspace operations, conflict analysis, semantic search, database status and analytics. Protected endpoints validate the session and applicable role.

## 11. Vector and semantic-search implementation

NOTAM and incident records store 384-dimensional embeddings generated with Xenova/all-MiniLM-L6-v2.

The embedding values are stored in PostgreSQL VECTOR(384) columns with model-name and generation-time metadata. The semantic search endpoint embeds a query with the same model and ranks records using cosine distance through pgvector. HNSW cosine indexes are defined for NOTAM and incident vectors.

To regenerate embeddings after setting up the environment, use the existing script:

    node scripts/generate-embeddings.mjs

Regeneration may download model files and requires access to the configured database. Do not rerun it unless embeddings need to be generated or refreshed.

## 12. SQL demonstrations

The file final_sql_demonstrations.sql covers:
- Multi-table joins
- Aggregation and grouping
- Subqueries
- Common table expressions
- Window functions
- Conflict severity summaries
- Vector dimension checks
- Constraint violation testing
- Transaction rollback

The main DDL is available at `database/12_DDL.sql`. DDL execution evidence is available at `docs/DDL_Query_Execution_Pranav_Yash.docx`. The populated database backup is distributed separately and is not committed to Git.

## 13. Security and data integrity

- Database credentials and authentication secrets are obtained through environment variables.
- Passwords are stored as password hashes.
- Authentication uses HTTP-only session cookies.
- ADMIN and OPERATOR permissions are enforced at protected API routes.
- Database primary keys, foreign keys, unique constraints and CHECK constraints protect relational integrity.
- Conflict resolution timestamps are maintained by a database trigger.

The supplied position records are demonstration data. The rule-based conflict analyzer is an academic project implementation, not a certified operational aviation safety system.

## 14. Team contributions

The project is intended as an equal two-member contribution. The contribution breakdown and commit history should be maintained transparently in GitHub.

## 15. Design and business-rule references

Refer to the database-design directory for the ER diagram, relational schema and business-rules/data-contract document.

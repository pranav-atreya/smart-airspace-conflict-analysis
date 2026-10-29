
\echo '========== 1. MULTI-TABLE JOIN: FLIGHT DETAILS =========='

SELECT
    f.flight_id,
    f.flight_number,
    a.registration_no,
    a.aircraft_type,
    dep.iata_code AS departure_iata,
    arr.iata_code AS arrival_iata,
    f.scheduled_departure,
    f.scheduled_arrival,
    f.status
FROM flight f
JOIN aircraft a
    ON a.aircraft_id = f.aircraft_id
JOIN airport dep
    ON dep.airport_id = f.departure_airport
JOIN airport arr
    ON arr.airport_id = f.arrival_airport
ORDER BY f.flight_number;


\echo '========== 2. AGGREGATION: FLIGHTS BY STATUS =========='

SELECT
    status,
    COUNT(*) AS flight_count,
    COUNT(*) FILTER (
        WHERE actual_departure IS NOT NULL
    ) AS flights_with_actual_departure
FROM flight
GROUP BY status
ORDER BY status;


\echo '========== 3. SUBQUERY: AIRCRAFT ABOVE AVERAGE ALTITUDE =========='

SELECT
    a.aircraft_id,
    a.registration_no,
    a.aircraft_type,
    a.max_altitude_ft
FROM aircraft a
WHERE a.max_altitude_ft > (
    SELECT AVG(a2.max_altitude_ft)
    FROM aircraft a2
    WHERE a2.max_altitude_ft IS NOT NULL
)
ORDER BY a.max_altitude_ft DESC;


\echo '========== 4. CTE: LATEST RECORDED POSITION PER FLIGHT =========='

WITH ranked_positions AS (
    SELECT
        fp.position_id,
        fp.flight_id,
        f.flight_number,
        fp.recorded_at,
        fp.latitude,
        fp.longitude,
        fp.altitude_ft,
        ROW_NUMBER() OVER (
            PARTITION BY fp.flight_id
            ORDER BY fp.recorded_at DESC, fp.position_id DESC
        ) AS position_rank
    FROM flight_position fp
    JOIN flight f
        ON f.flight_id = fp.flight_id
)
SELECT
    flight_number,
    recorded_at,
    latitude,
    longitude,
    altitude_ft
FROM ranked_positions
WHERE position_rank = 1
ORDER BY flight_number;


\echo '========== 5. WINDOW FUNCTION: RANK FLIGHTS WITHIN STATUS =========='

SELECT
    flight_number,
    status,
    scheduled_departure,
    RANK() OVER (
        PARTITION BY status
        ORDER BY scheduled_departure DESC
    ) AS departure_rank
FROM flight
ORDER BY status, departure_rank;


\echo '========== 6. CONFLICT SUMMARY BY SEVERITY =========='

SELECT
    severity,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (
        WHERE resolved = FALSE
    ) AS unresolved_events,
    COUNT(*) FILTER (
        WHERE resolved = TRUE
    ) AS resolved_events
FROM conflict_event
GROUP BY severity
ORDER BY severity;


\echo '========== 7. VECTOR EMBEDDING DIMENSIONS =========='

SELECT
    'NOTAM' AS source,
    COUNT(*) AS total_records,
    COUNT(embedding) AS embedded_records,
    MIN(vector_dims(embedding)) AS min_dimensions,
    MAX(vector_dims(embedding)) AS max_dimensions
FROM notam

UNION ALL

SELECT
    'INCIDENT',
    COUNT(*),
    COUNT(embedding),
    MIN(vector_dims(embedding)),
    MAX(vector_dims(embedding))
FROM incident;


\echo '========== 8. CONSTRAINT TEST: INVALID ALTITUDE RANGE =========='

DO $$
BEGIN
    BEGIN
        INSERT INTO restricted_airspace (
            airspace_code,
            airspace_name,
            restriction_type,
            center_latitude,
            center_longitude,
            radius_nm,
            lower_altitude_ft,
            upper_altitude_ft,
            valid_from,
            valid_to
        )
        VALUES (
            'DBMS-CONSTRAINT-TEST',
            'Temporary constraint test',
            'RESTRICTED',
            12.0,
            77.0,
            5.0,
            20000,
            10000,
            TIMESTAMP '2026-10-28 00:00:00',
            TIMESTAMP '2026-11-01 00:00:00'
        );

        RAISE EXCEPTION
            'FAIL: The invalid altitude range was accepted.';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE
                'PASS: PostgreSQL rejected the invalid altitude range.';
    END;
END
$$;


\echo '========== 9. TRANSACTION TEST: INSERT THEN ROLLBACK =========='

BEGIN;

INSERT INTO flight (
    flight_number,
    aircraft_id,
    departure_airport,
    arrival_airport,
    scheduled_departure,
    scheduled_arrival,
    status
)
VALUES (
    'RBTEST_281026_47',
    1,
    1,
    2,
    TIMESTAMP '2026-10-29 00:00:00',
    TIMESTAMP '2026-10-29 01:00:00',
    'SCHEDULED'
)
RETURNING flight_id, flight_number, status;

SELECT
    flight_number,
    status
FROM flight
WHERE flight_number = 'RBTEST_281026_47';

ROLLBACK;

SELECT
    COUNT(*) AS rollback_test_records_remaining
FROM flight
WHERE flight_number = 'RBTEST_281026_47';

\echo '========== 10. HAVING: SEVERITY GROUPS WITH MULTIPLE CONFLICTS =========='

SELECT
    severity,
    COUNT(*) AS conflict_count
FROM conflict_event
GROUP BY severity
HAVING COUNT(*) >= 2
ORDER BY conflict_count DESC, severity;

\echo '========== SQL DEMONSTRATIONS COMPLETED =========='

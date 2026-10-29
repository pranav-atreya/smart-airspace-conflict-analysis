
import { createRequire } from "node:module";
import { pipeline } from "@huggingface/transformers";
import pg from "pg";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const { Pool } = pg;
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const DIMENSIONS = 384;

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "smart_airspace_db",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 10000,
});

async function main() {
  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    const connection = await client.query(
      "SELECT current_database() AS database_name"
    );

    console.log(
      `Connected to database: ${connection.rows[0].database_name}`
    );

    // Record which model generated each vector.
    await client.query(`
      ALTER TABLE notam
      ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(120)
    `);

    await client.query(`
      ALTER TABLE notam
      ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP
    `);

    await client.query(`
      ALTER TABLE incident
      ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(120)
    `);

    await client.query(`
      ALTER TABLE incident
      ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP
    `);

    // Leave any existing embeddings untouched.
    const notamResult = await client.query(`
      SELECT notam_id, title, notam_text
      FROM notam
      WHERE embedding IS NULL
      ORDER BY notam_id
    `);

    const incidentResult = await client.query(`
      SELECT
        incident_id,
        incident_title,
        description,
        incident_type,
        severity
      FROM incident
      WHERE embedding IS NULL
      ORDER BY incident_id
    `);

    const documents = [
      ...notamResult.rows.map((row) => ({
        kind: "NOTAM",
        id: row.notam_id,
        text: `${row.title}. ${row.notam_text}`.trim(),
      })),

      ...incidentResult.rows.map((row) => ({
        kind: "INCIDENT",
        id: row.incident_id,
        text: [
          row.incident_title,
          row.description,
          `Incident type: ${row.incident_type}`,
          `Severity: ${row.severity}`,
        ]
          .filter(Boolean)
          .join(". "),
      })),
    ];

    console.log(`NOTAMs needing embeddings: ${notamResult.rowCount}`);
    console.log(`Incidents needing embeddings: ${incidentResult.rowCount}`);

    if (documents.length === 0) {
      console.log("All records already have embeddings.");
      return;
    }

    console.log(`Loading model: ${MODEL_NAME}`);
    console.log(
      "The first run may download model files. Allow it to finish."
    );

    const extractor = await pipeline(
      "feature-extraction",
      MODEL_NAME
    );

    // Mean pooling and normalization produce sentence embeddings.
    const output = await extractor(
      documents.map((document) => document.text),
      { pooling: "mean", normalize: true }
    );

    const vectors = output.tolist();

    if (vectors.length !== documents.length) {
      throw new Error("The generated embedding count is incorrect.");
    }

    for (const vector of vectors) {
      if (
        vector.length !== DIMENSIONS ||
        vector.some((value) => !Number.isFinite(value))
      ) {
        throw new Error(
          `Expected ${DIMENSIONS} finite values per embedding.`
        );
      }
    }

    // Use one checked-out connection for the complete transaction.
    await client.query("BEGIN");
    transactionStarted = true;

    let savedNotams = 0;
    let savedIncidents = 0;

    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      const vectorLiteral = `[${vectors[index].join(",")}]`;

      let result;

      if (document.kind === "NOTAM") {
        result = await client.query(
          `
          UPDATE notam
          SET
            embedding = $1::vector,
            embedding_model = $2,
            embedding_generated_at = CURRENT_TIMESTAMP
          WHERE notam_id = $3
            AND embedding IS NULL
          `,
          [vectorLiteral, MODEL_NAME, document.id]
        );

        savedNotams += result.rowCount ?? 0;
      } else {
        result = await client.query(
          `
          UPDATE incident
          SET
            embedding = $1::vector,
            embedding_model = $2,
            embedding_generated_at = CURRENT_TIMESTAMP
          WHERE incident_id = $3
            AND embedding IS NULL
          `,
          [vectorLiteral, MODEL_NAME, document.id]
        );

        savedIncidents += result.rowCount ?? 0;
      }

      console.log(
        `${document.kind} #${document.id}: ` +
          (result.rowCount ? "embedding stored" : "skipped; already populated")
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    console.log("\nEmbedding generation completed.");
    console.log(`NOTAM embeddings saved: ${savedNotams}`);
    console.log(`Incident embeddings saved: ${savedIncidents}`);
    console.log(`Model: ${MODEL_NAME}`);
    console.log(`Dimensions: ${DIMENSIONS}`);
    console.log("Similarity metric: cosine distance");
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("\nEmbedding generation failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

await main();


import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { authorizeRequest } from "@/lib/authorization";
import {
  embedText,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "@/lib/embeddings";

const searchSchema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN", "OPERATOR"]);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const body = await request.json();
    const parsed = searchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "Enter a search query between 3 and 500 characters.",
        },
        { status: 400 }
      );
    }

    const query = parsed.data.query;
    const limit = parsed.data.limit ?? 8;

    // Generate the query embedding with the same model as the stored documents.
    const embedding = await embedText(query);

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error("The query embedding has an invalid dimension.");
    }

    const vectorLiteral = `[${embedding.join(",")}]`;

    const result = await pool.query(
      `
      WITH documents AS (
        SELECT
          'NOTAM'::text AS source_type,
          notam_id::integer AS source_id,
          title::text AS title,
          notam_text::text AS content,
          status::text AS record_status,
          issued_at AS event_date,
          embedding <=> $1::vector AS distance
        FROM notam
        WHERE embedding IS NOT NULL

        UNION ALL

        SELECT
          'INCIDENT'::text AS source_type,
          incident_id::integer AS source_id,
          incident_title::text AS title,
          COALESCE(description, '')::text AS content,
          severity::text AS record_status,
          occurred_at AS event_date,
          embedding <=> $1::vector AS distance
        FROM incident
        WHERE embedding IS NOT NULL
      )
      SELECT
        source_type,
        source_id,
        title,
        content,
        record_status,
        event_date,
        (1.0 - distance)::double precision AS similarity
      FROM documents
      ORDER BY distance ASC
      LIMIT $2
      `,
      [vectorLiteral, limit]
    );

    return NextResponse.json({
      ok: true,
      query,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      similarityMetric: "cosine similarity",
      resultCount: result.rows.length,
      results: result.rows,
    });
  } catch (error) {
    console.error("Semantic search failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          "Semantic search failed. Check the Next.js server terminal.",
      },
      { status: 500 }
    );
  }
}

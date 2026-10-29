
import { pipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

type EmbeddingOutput = {
  data: ArrayLike<number>;
};

type FeatureExtractor = (
  text: string,
  options: {
    pooling: "mean";
    normalize: true;
  }
) => Promise<EmbeddingOutput>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      EMBEDDING_MODEL
    ).then((extractor) => extractor as unknown as FeatureExtractor);
  }

  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data);

  if (
    embedding.length !== EMBEDDING_DIMENSIONS ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Embedding model returned an invalid vector; expected ${EMBEDDING_DIMENSIONS} dimensions.`
    );
  }

  return embedding;
}

import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = "https://f94668e7-2850-4bc2-84a4-845c6382a425.us-east4-0.gcp.cloud.qdrant.io:6333";
const QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.Uy9TEGUmFZH6kLVflL-EjsUBep2DcDaC-FHBm8bn9RY";
const COLLECTION_NAME = "voice_agent_knowledge_base";

export const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    documentId: string;
    title?: string;
    pageNumber?: number;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: DocumentChunk["metadata"];
}

/**
 * Initialize or get the collection
 */
export async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (col) => col.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small dimension
          distance: "Cosine",
        },
      });
      console.log(`Created collection: ${COLLECTION_NAME}`);
    } else {
      console.log(`Collection ${COLLECTION_NAME} already exists`);
    }
  } catch (error) {
    console.error("Error ensuring collection:", error);
    throw error;
  }
}

/**
 * Upsert document chunks into Qdrant
 */
export async function upsertChunks(chunks: DocumentChunk[], embeddings: number[][]) {
  await ensureCollection();

  const points = chunks.map((chunk, index) => ({
    id: chunk.id,
    vector: embeddings[index],
    payload: {
      content: chunk.content,
      ...chunk.metadata,
    },
  }));

  try {
    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });
    console.log(`Upserted ${points.length} chunks to Qdrant`);
  } catch (error) {
    console.error("Error upserting chunks:", error);
    throw error;
  }
}

/**
 * Search for similar documents
 */
export async function searchSimilar(
  queryEmbedding: number[],
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    const searchResults = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
    });

    return searchResults.map((result) => ({
      id: result.id as string,
      score: result.score,
      content: result.payload?.content as string,
      metadata: {
        source: result.payload?.source as string,
        chunkIndex: result.payload?.chunkIndex as number,
        totalChunks: result.payload?.totalChunks as number,
        documentId: result.payload?.documentId as string,
        title: result.payload?.title as string | undefined,
        pageNumber: result.payload?.pageNumber as number | undefined,
      },
    }));
  } catch (error) {
    console.error("Error searching Qdrant:", error);
    throw error;
  }
}

/**
 * Get collection stats
 */
export async function getCollectionStats() {
  try {
    const info = await qdrantClient.getCollection(COLLECTION_NAME);
    return {
      pointsCount: info.points_count || 0,
      indexedVectorsCount: info.indexed_vectors_count || 0,
      segmentsCount: info.segments_count || 0,
    };
  } catch (error) {
    console.error("Error getting collection stats:", error);
    throw error;
  }
}

/**
 * Delete all points for a specific document
 */
export async function deleteDocument(documentId: string) {
  try {
    await qdrantClient.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "documentId",
            match: { value: documentId },
          },
        ],
      },
    });
    console.log(`Deleted document ${documentId} from Qdrant`);
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
}


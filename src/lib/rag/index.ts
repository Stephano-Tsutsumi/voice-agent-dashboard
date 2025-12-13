/**
 * RAG Pipeline - Main entry point
 */

import { processDocuments, type DocumentChunk } from "./chunking";
import { generateEmbeddings } from "./embeddings";
import { upsertChunks, searchSimilar, ensureCollection, type SearchResult } from "./qdrant";
import { generateEmbedding } from "./embeddings";

export interface Document {
  content: string;
  documentId: string;
  source: string;
  title?: string;
  pageNumber?: number;
}

/**
 * Ingest documents into the knowledge base
 */
export async function ingestDocuments(documents: Document[]): Promise<void> {
  console.log(`Processing ${documents.length} documents...`);

  // Step 1: Chunk documents
  const chunks = processDocuments(documents);
  console.log(`Created ${chunks.length} chunks`);

  // Step 2: Generate embeddings
  const chunkTexts = chunks.map((chunk) => chunk.content);
  console.log("Generating embeddings...");
  const embeddings = await generateEmbeddings(chunkTexts);

  // Step 3: Store in Qdrant
  console.log("Storing in Qdrant...");
  await upsertChunks(chunks, embeddings);

  console.log("Documents ingested successfully!");
}

/**
 * Search the knowledge base
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Search Qdrant
  const results = await searchSimilar(queryEmbedding, limit);

  return results;
}

/**
 * Initialize the RAG system
 */
export async function initializeRAG(): Promise<void> {
  await ensureCollection();
  console.log("RAG system initialized");
}

export type { DocumentChunk, SearchResult };


import { DocumentChunk } from "./qdrant";
import { v4 as uuidv4 } from "uuid";

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap || DEFAULT_CHUNK_OVERLAP;

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf(".");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > chunkSize * 0.5) {
        // Only break if we're not too close to the start
        chunk = chunk.slice(0, breakPoint + 1);
        start += breakPoint + 1;
      } else {
        start = end - chunkOverlap; // Overlap for next chunk
      }
    } else {
      start = end;
    }

    chunks.push(chunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Process a document and create chunks with metadata
 */
export function processDocument(
  content: string,
  documentId: string,
  metadata: {
    source: string;
    title?: string;
    pageNumber?: number;
  }
): DocumentChunk[] {
  const textChunks = chunkText(content);
  
  return textChunks.map((chunk, index) => ({
    id: uuidv4(), // Generate UUID for Qdrant compatibility
    content: chunk,
    metadata: {
      source: metadata.source,
      chunkIndex: index,
      totalChunks: textChunks.length,
      documentId,
      title: metadata.title,
      pageNumber: metadata.pageNumber,
    },
  }));
}

/**
 * Process multiple documents
 */
export function processDocuments(
  documents: Array<{
    content: string;
    documentId: string;
    source: string;
    title?: string;
    pageNumber?: number;
  }>
): DocumentChunk[] {
  const allChunks: DocumentChunk[] = [];

  for (const doc of documents) {
    const chunks = processDocument(doc.content, doc.documentId, {
      source: doc.source,
      title: doc.title,
      pageNumber: doc.pageNumber,
    });
    allChunks.push(...chunks);
  }

  return allChunks;
}


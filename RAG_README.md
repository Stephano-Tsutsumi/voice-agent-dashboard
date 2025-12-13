# RAG Pipeline Documentation

This project includes a complete RAG (Retrieval-Augmented Generation) pipeline that allows the voice agent to reference ground truth documentation stored in a Qdrant vector database.

## Architecture

### Components

1. **Document Ingestion** (`/api/rag/ingest`)
   - Accepts documents (text files)
   - Chunks documents into smaller pieces (1000 chars with 200 char overlap)
   - Generates embeddings using OpenAI `text-embedding-3-small`
   - Stores in Qdrant vector database

2. **Vector Database** (Qdrant)
   - Collection: `voice_agent_knowledge_base`
   - Vector dimension: 1536 (OpenAI embedding size)
   - Distance metric: Cosine similarity

3. **Search/Retrieval** (`/api/rag/search`)
   - Accepts a query string
   - Generates query embedding
   - Searches Qdrant for similar chunks
   - Returns top-k results with metadata

4. **Voice Agent Integration**
   - `searchKnowledgeBase` tool available to the agent
   - Agent can automatically search documentation when needed
   - Results are formatted and returned to the agent

## Usage

### 1. Upload Documents

Visit `/rag-upload` or use the API:

```bash
POST /api/rag/ingest
Content-Type: application/json

{
  "documents": [
    {
      "content": "Your document text here...",
      "documentId": "doc_001",
      "source": "manual.pdf",
      "title": "User Manual",
      "pageNumber": 1
    }
  ]
}
```

### 2. Search Knowledge Base

The voice agent automatically uses the knowledge base when needed. You can also search manually:

```bash
POST /api/rag/search
Content-Type: application/json

{
  "query": "How do I reset my password?",
  "limit": 5
}
```

Or via GET:
```
GET /api/rag/search?q=password+reset&limit=5
```

### 3. Check Stats

```bash
GET /api/rag/stats
```

Returns collection statistics (number of points, vectors, etc.)

## How It Works

1. **Chunking Strategy**
   - Documents are split into ~1000 character chunks
   - 200 character overlap between chunks to preserve context
   - Attempts to break at sentence boundaries when possible

2. **Embedding Generation**
   - Uses OpenAI's `text-embedding-3-small` model
   - 1536-dimensional vectors
   - Batch processing for efficiency

3. **Storage**
   - Each chunk stored as a point in Qdrant
   - Metadata includes: source, title, page number, chunk index
   - Enables filtering and source attribution

4. **Retrieval**
   - Query is embedded using the same model
   - Cosine similarity search in Qdrant
   - Returns top-k most relevant chunks
   - Results include source attribution

## Voice Agent Integration

The voice agent has access to a `searchKnowledgeBase` tool that:
- Automatically searches when documentation is needed
- Returns formatted results with source information
- Helps the agent provide accurate, grounded responses

Example agent usage:
```
User: "What's the refund policy?"
Agent: [calls searchKnowledgeBase("refund policy")]
Agent: "According to the documentation, our refund policy states..."
```

## Configuration

### Qdrant Settings
- URL: `https://f94668e7-2850-4bc2-84a4-845c6382a425.us-east4-0.gcp.cloud.qdrant.io:6333`
- API Key: Configured in `src/lib/rag/qdrant.ts`
- Collection: `voice_agent_knowledge_base`

### Embedding Settings
- Model: `text-embedding-3-small`
- Dimension: 1536
- Provider: OpenAI (requires `OPENAI_API_KEY`)

### Chunking Settings
- Default chunk size: 1000 characters
- Default overlap: 200 characters
- Configurable in `src/lib/rag/chunking.ts`

## File Structure

```
src/lib/rag/
├── qdrant.ts          # Qdrant client and operations
├── embeddings.ts      # OpenAI embedding generation
├── chunking.ts        # Document chunking logic
└── index.ts           # Main RAG pipeline entry point

src/app/api/rag/
├── ingest/route.ts    # Document ingestion endpoint
├── search/route.ts    # Search endpoint
└── stats/route.ts     # Statistics endpoint

src/app/rag-upload/
└── page.tsx           # UI for uploading documents
```

## Best Practices

1. **Document Quality**
   - Use clear, well-structured text
   - Include relevant metadata (titles, sources)
   - Remove unnecessary formatting

2. **Chunking**
   - Ensure chunks are semantically complete
   - Adjust chunk size based on document type
   - Consider document structure (sections, paragraphs)

3. **Search Queries**
   - Use specific, descriptive queries
   - Consider synonyms and related terms
   - Test with various query types

4. **Maintenance**
   - Regularly update documents
   - Monitor collection size
   - Review search result quality

## Troubleshooting

### Documents not appearing in search
- Check that ingestion completed successfully
- Verify embeddings were generated
- Check Qdrant collection stats

### Poor search results
- Try different query phrasings
- Increase chunk size if context is lost
- Review document quality and structure

### API errors
- Verify OpenAI API key is set
- Check Qdrant connection and credentials
- Review server logs for detailed errors


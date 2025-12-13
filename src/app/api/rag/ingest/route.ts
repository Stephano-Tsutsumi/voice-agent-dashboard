import { NextRequest, NextResponse } from "next/server";
import { ingestDocuments, type Document } from "@/lib/rag";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents } = body;

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json(
        { error: "Invalid request: documents array required" },
        { status: 400 }
      );
    }

    // Validate document structure
    for (const doc of documents) {
      if (!doc.content || !doc.documentId || !doc.source) {
        return NextResponse.json(
          { error: "Each document must have content, documentId, and source" },
          { status: 400 }
        );
      }
    }

    await ingestDocuments(documents as Document[]);

    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${documents.length} documents`,
    });
  } catch (error) {
    console.error("Error ingesting documents:", error);
    return NextResponse.json(
      {
        error: "Failed to ingest documents",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


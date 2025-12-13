import { NextRequest, NextResponse } from "next/server";
import { getCollectionStats } from "@/lib/rag/qdrant";

export async function GET(request: NextRequest) {
  try {
    const stats = await getCollectionStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting RAG stats:", error);
    return NextResponse.json(
      {
        error: "Failed to get RAG stats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


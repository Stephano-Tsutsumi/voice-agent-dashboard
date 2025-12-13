import { NextRequest, NextResponse } from "next/server";
import { saveAnnotation, getFailureModes, getErrorTypeDistribution, getCallsByErrorType } from "@/lib/db";
import { type Annotation } from "@/lib/calls";

export async function POST(request: NextRequest) {
  try {
    const { callId, annotation } = await request.json();
    saveAnnotation(callId, annotation);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving annotation:", error);
    return NextResponse.json(
      { error: "Failed to save annotation", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const errorType = searchParams.get("errorType");

    if (errorType) {
      const calls = getCallsByErrorType(errorType);
      return NextResponse.json(calls);
    }

    if (type === "failure-modes") {
      const modes = getFailureModes();
      return NextResponse.json(modes);
    }

    if (type === "error-distribution") {
      const distribution = getErrorTypeDistribution();
      return NextResponse.json(distribution);
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch annotations" },
      { status: 500 }
    );
  }
}


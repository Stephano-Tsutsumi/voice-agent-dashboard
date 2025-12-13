import { NextRequest, NextResponse } from "next/server";
import { getCalls, searchCalls, getCallById, saveCall, getFailureModes, getErrorTypeDistribution, getCallsByFailureMode } from "@/lib/db";
import { type Call } from "@/lib/calls";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const callId = searchParams.get("callId");
    const failureMode = searchParams.get("failureMode");

    if (callId) {
      const call = getCallById(callId);
      if (!call) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      return NextResponse.json(call);
    }

    if (failureMode) {
      const calls = getCallsByFailureMode(failureMode);
      return NextResponse.json(calls);
    }

    if (search) {
      const calls = searchCalls(search);
      return NextResponse.json(calls);
    }

    const calls = getCalls();
    return NextResponse.json(calls);
  } catch (error) {
    console.error("Error fetching calls:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const callData = await request.json();
    console.log("Received call data:", callData);
    
    // Convert date string back to Date object
    const call: Call = {
      ...callData,
      date: new Date(callData.date),
    };
    
    console.log("Saving call to database:", call.callId);
    saveCall(call);
    console.log("Call saved successfully");
    
    return NextResponse.json({ success: true, callId: call.callId });
  } catch (error) {
    console.error("Error saving call:", error);
    return NextResponse.json(
      { 
        error: "Failed to save call", 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}


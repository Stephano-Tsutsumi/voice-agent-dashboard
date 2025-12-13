import { NextRequest, NextResponse } from "next/server";
import { saveTestCase, getTestCasesByFailureMode } from "@/lib/db";
import { type TestCase } from "@/lib/test-cases";

export async function POST(request: NextRequest) {
  try {
    const testCaseData = await request.json();
    const testCase: TestCase = {
      ...testCaseData,
      createdAt: new Date(testCaseData.createdAt || Date.now()),
      updatedAt: new Date(),
    };
    saveTestCase(testCase);
    return NextResponse.json({ success: true, testCase });
  } catch (error) {
    console.error("Error saving test case:", error);
    return NextResponse.json(
      { error: "Failed to save test case", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const failureMode = searchParams.get("failureMode");

    if (!failureMode) {
      return NextResponse.json({ error: "failureMode parameter required" }, { status: 400 });
    }

    const testCases = getTestCasesByFailureMode(failureMode);
    return NextResponse.json(testCases);
  } catch (error) {
    console.error("Error fetching test cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch test cases" },
      { status: 500 }
    );
  }
}


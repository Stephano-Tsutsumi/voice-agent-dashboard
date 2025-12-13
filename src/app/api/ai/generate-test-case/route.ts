import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { failureMode, observations, exampleCalls } = await request.json();
    
    if (!failureMode) {
      return NextResponse.json({ error: "Missing failureMode" }, { status: 400 });
    }

    const prompt = `You are a QA engineer creating test cases for voice agent failures. Based on the failure mode and observations, create the simplest possible test case that can reproduce this failure.

Failure Mode: ${failureMode}

${observations ? `Observations:\n${Array.isArray(observations) ? observations.join("\n") : observations}` : ""}

${exampleCalls && exampleCalls.length > 0 ? `Example calls that exhibited this failure:\n${exampleCalls.map((call: any, idx: number) => 
  `${idx + 1}. Call ID: ${call.callId}\n   Transcript: ${call.transcript?.substring(0, 500) || "N/A"}\n   Observations: ${call.annotation?.observations || "N/A"}`
).join("\n\n")}` : ""}

Create a test case that:
1. Is the simplest possible scenario to reproduce the failure
2. Has clear, step-by-step instructions
3. Includes expected vs actual behavior
4. Can be used in UAT (User Acceptance Testing)

Return a JSON object with:
{
  "testCase": "Brief description of the test case",
  "steps": "Step-by-step instructions to reproduce (numbered list)",
  "expectedResult": "What should happen",
  "actualResult": "What actually happens (the failure)"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert QA engineer specializing in creating minimal, reproducible test cases for AI voice agents. Always return valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating test case:", error);
    return NextResponse.json(
      { error: "Failed to generate test case", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


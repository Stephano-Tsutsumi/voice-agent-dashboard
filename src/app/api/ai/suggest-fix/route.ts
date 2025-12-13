import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { failureMode, observations, transcript } = await request.json();
    
    if (!failureMode || !observations) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const prompt = `You are analyzing a voice agent failure. Based on the failure mode and observations, suggest specific fixes.

Failure Mode: ${failureMode}

Observations:
${Array.isArray(observations) ? observations.join("\n") : observations}

${transcript ? `Call Transcript:\n${transcript.substring(0, 2000)}` : ""}

Provide a specific, actionable fix suggestion. Include:
1. What needs to be changed
2. Why this change will help
3. Specific implementation guidance (e.g., prompt modifications, code changes)

Return a JSON object with:
{
  "suggestedFix": "Detailed fix suggestion",
  "implementation": "Specific steps to implement",
  "rationale": "Why this fix addresses the failure mode"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at diagnosing and fixing AI agent failures. Provide specific, actionable suggestions. Always return valid JSON.",
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
    console.error("Error suggesting fix:", error);
    return NextResponse.json(
      { error: "Failed to suggest fix", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


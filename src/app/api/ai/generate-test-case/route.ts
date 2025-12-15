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
2. Has a clear persona and user input/value
3. Includes the expected agent response
4. Specifies an escalation path (if any)
5. Can be used in UAT (User Acceptance Testing)

Return a JSON object with:
{
  "testCaseId": "Short identifier for this test case (e.g. TC_UNEXPECTED_001)",
  "testScenario": "High-level scenario description (e.g. multiple household members)",
  "personaType": "Persona description (e.g. multiple household members with 1 enrollment)",
  "userInput": "What the user says or provides (e.g. user gives name with multiple household members)",
  "expectedResponse": "What the assistant should say/do (e.g. ask if they need username for self or another household member, then provide the appropriate username)",
  "escalationPath": "Escalation behavior if applicable (e.g. transferred to CSR, external transfer, etc.)"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert QA engineer specializing in creating minimal, reproducible test cases for AI voice agents. Always return a single valid JSON object matching the requested schema. Do not include any surrounding prose or markdown fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const rawContent = completion.choices[0].message.content || "";

    // Try to extract JSON even if the model wraps it in prose or ```json fences
    let jsonText = rawContent.trim();
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      jsonText = fenceMatch[1].trim();
    }

    // Fallback: try to slice from first { to last }
    if (!jsonText.startsWith("{")) {
      const first = jsonText.indexOf("{");
      const last = jsonText.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        jsonText = jsonText.slice(first, last + 1);
      }
    }

    const result = JSON.parse(jsonText);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating test case:", error);
    return NextResponse.json(
      { error: "Failed to generate test case", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


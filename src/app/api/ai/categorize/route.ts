import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { observations } = await request.json();
    
    if (!observations || !Array.isArray(observations)) {
      return NextResponse.json({ error: "Invalid observations" }, { status: 400 });
    }

    const prompt = `You are analyzing voice agent call annotations. Review these observations and categorize them into coherent failure modes. Group similar issues together.

Observations:
${observations.map((obs: string, idx: number) => `${idx + 1}. ${obs}`).join("\n")}

Return a JSON object with:
1. "failureModes": An array of objects with "mode" (the failure mode name) and "observations" (array of observation indices that belong to this mode)
2. "suggestions": An array of suggested fixes for each failure mode

Example response format:
{
  "failureModes": [
    {
      "mode": "persona-tone mismatch",
      "observations": [1, 3, 5],
      "description": "The agent uses inappropriate tone for the target audience"
    }
  ],
  "suggestions": [
    {
      "mode": "persona-tone mismatch",
      "fix": "Add explicit tone guidelines in the system prompt based on user persona"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing AI agent failures and categorizing them into actionable failure modes. Always return valid JSON.",
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
    console.error("Error categorizing observations:", error);
    return NextResponse.json(
      { error: "Failed to categorize observations", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


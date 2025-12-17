import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { failureMode, testCase, observations, problemDescription } = await request.json();
    
    if (!failureMode || !testCase) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const prompt = `You are creating a bug ticket for a voice agent failure. Based on the failure mode, test case, and problem description, create a well-structured ticket.

Failure Mode: ${failureMode}

Test Case:
${typeof testCase === "string" ? testCase : JSON.stringify(testCase, null, 2)}

${observations ? `Observations:\n${Array.isArray(observations) ? observations.join("\n") : observations}` : ""}

${problemDescription ? `Problem Description:\n${problemDescription}` : ""}

Create a bug ticket with:
1. A clear, concise title
2. Detailed description of the issue
3. Steps to reproduce (from test case)
4. Expected vs actual behavior
5. Priority level (low, medium, high, critical)
6. Any relevant context

Return a JSON object with:
{
  "title": "Clear, concise bug title",
  "description": "Detailed description including steps to reproduce, expected vs actual behavior, and impact",
  "priority": "low|medium|high|critical"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating clear, actionable bug tickets for AI voice agents. Always return a single valid JSON object matching the requested schema. Do not include any surrounding prose or markdown fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    let content = completion.choices[0].message.content || "{}";
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }
    
    const result = JSON.parse(content);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


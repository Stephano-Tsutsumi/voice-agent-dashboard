import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, errorDistribution, failureModes, context } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const systemPrompt = `You are an AI assistant helping analyze voice agent failures. You can:
1. Analyze error distributions and suggest common failure modes
2. Generate test cases for failure modes
3. Help identify patterns in voice agent errors

You have access to:
- Error Type Distribution: ${errorDistribution ? JSON.stringify(errorDistribution) : "No data"}
- Existing Failure Modes: ${failureModes ? JSON.stringify(failureModes) : "No data"}
${context ? `- Additional Context: ${context}` : ""}

Be helpful, concise, and actionable. When suggesting failure modes or generating test cases, provide structured, usable output.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "Failed to process chat message", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getCallsByErrorType } from "@/lib/db";
import { searchKnowledgeBase } from "@/lib/rag";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Map natural phrases to canonical error types
const ERROR_TYPE_ALIASES: Record<string, string> = {
  tone_mismatch: "tone_mismatch",
  "tone mismatch": "tone_mismatch",
  missing_information: "missing_information",
  "missing information": "missing_information",
  incorrect_response: "incorrect_response",
  "incorrect response": "incorrect_response",
  technical_error: "technical_error",
  "technical error": "technical_error",
  timeout: "timeout",
  "user_confusion": "user_confusion",
  "user confusion": "user_confusion",
  hallucination: "hallucination",
  "external transfer": "ext_transfer",
  ext_transfer: "ext_transfer",
  "csr transfer": "csr_transfer",
  csr_transfer: "csr_transfer",
  expected: "expected",
  unexpected: "unexpected",
  unknown: "unknown",
};

function detectErrorTypeFromMessage(message: string): string | null {
  const lower = message.toLowerCase();

  // Direct alias match
  for (const [phrase, canonical] of Object.entries(ERROR_TYPE_ALIASES)) {
    if (lower.includes(phrase)) return canonical;
  }

  // Generic patterns: "error type X", "tagged with X"
  const genericMatch =
    lower.match(/error type\s+([a-z_ ]+)/i) ||
    lower.match(/tagged with\s+([a-z_ ]+)/i);

  if (genericMatch?.[1]) {
    const key = genericMatch[1].trim().toLowerCase();
    return ERROR_TYPE_ALIASES[key] || null;
  }

  return null;
}

function isPromptImprovementQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  const promptKeywords = [
    "prompt improvement",
    "improve prompt",
    "how to improve",
    "better prompt",
    "prompt recommendation",
    "prompt suggestions",
    "voice agent improvement",
    "how to improve voice agent",
    "agent improvement",
    "prompt optimization",
    "optimize prompt",
  ];
  
  return promptKeywords.some(keyword => lower.includes(keyword));
}

export async function POST(request: NextRequest) {
  try {
    const { message, errorDistribution, failureModes, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Check if this is a prompt improvement question
    const isPromptQuestion = isPromptImprovementQuestion(message);
    let ragContext = "";

    if (isPromptQuestion) {
      // Use RAG to search for voice agent evaluation guidelines
      try {
        const searchQuery = message.includes("voice agent") 
          ? message 
          : `${message} voice agent evaluation guidelines`;
        
        const ragResults = await searchKnowledgeBase(searchQuery, 5);
        
        if (ragResults.length > 0) {
          const guidelinesText = ragResults
            .map((result, idx) => `[${idx + 1}] ${result.content}\n   Source: ${result.metadata.title || result.metadata.source || "Voice Agent Evals Guidelines"}`)
            .join("\n\n");
          
          ragContext = `You are a prompt improvement specialist. Use the following Voice Agent Evaluation Guidelines as your reference material:\n\n${guidelinesText}\n\nBased on these guidelines and the user's question, provide specific, actionable prompt improvement recommendations. Reference the guidelines when making suggestions.`;
        } else {
          ragContext = "You are a prompt improvement specialist. The user is asking about prompt improvements, but no evaluation guidelines have been uploaded yet. Provide general best practices for voice agent prompt engineering based on your knowledge.";
        }
      } catch (error) {
        console.error("Error searching knowledge base:", error);
        ragContext = "You are a prompt improvement specialist. Provide recommendations based on best practices for voice agent prompt engineering.";
      }
    }

    // STEP 2: infer error type from the user query (e.g. "unexpected", "unknown")
    const inferredErrorType = detectErrorTypeFromMessage(message);
    let callsContext = "";

    if (inferredErrorType) {
      // STEP 3: fetch calls by error type and build a compact observations summary
      const calls = getCallsByErrorType(inferredErrorType);

      if (calls.length === 0) {
        callsContext = `You are analyzing error type "${inferredErrorType}", but there are currently no calls tagged with this error type. Explain that there is no data yet and suggest what kind of annotations would be useful to collect.`;
      } else {
        const summaries = calls
          .slice(0, 50) // safety cap
          .map((call) => ({
            callId: call.callId,
            date: call.date,
            status: call.status,
            errorType: call.annotation?.errorType || call.annotation?.errorTypeCustom,
            failureMode: call.annotation?.failureMode,
            observations: call.annotation?.observations,
          }))
          .filter((entry) => entry.observations && entry.observations.trim().length > 0);

        callsContext = `You are currently analyzing calls tagged with error type "${inferredErrorType}". Here is a JSON array summarizing the most recent calls and their human-written observations:\n${JSON.stringify(
          summaries,
          null,
          2
        )}\n\nUse these observations to derive insights, common themes, and failure patterns. When the user asks for follow-up actions (like how to improve prompts), give concrete, implementation-ready suggestions.`;
      }
    }

    // STEP 4: include observations in the system prompt so the LLM can answer with real insights
    let systemPrompt = "";
    
    if (isPromptQuestion && ragContext) {
      // Specialized prompt improvement sub-agent
      systemPrompt = `${ragContext}

You have access to:
- Error Type Distribution: ${errorDistribution ? JSON.stringify(errorDistribution) : "No data"}
- Existing Failure Modes: ${failureModes ? JSON.stringify(failureModes) : "No data"}
${context ? `- Additional Context: ${context}\n` : ""}${
        callsContext ? `\n${callsContext}\n` : ""
      }

When providing prompt improvement recommendations:
- Be specific and actionable
- Reference the evaluation guidelines when applicable
- Consider the failure modes and error patterns in the data
- Provide concrete examples of improved prompts
- Explain why your suggestions will help`;
    } else {
      // Standard analysis assistant
      systemPrompt = `You are an AI assistant helping analyze voice agent failures. You can:
1. Analyze error distributions and suggest common failure modes
2. Generate test cases for failure modes
3. Help identify patterns in voice agent errors
4. Answer questions about calls and annotations
5. Provide concrete, actionable recommendations to improve prompts, routing, and tagging

You have access to:
- Error Type Distribution: ${errorDistribution ? JSON.stringify(errorDistribution) : "No data"}
- Existing Failure Modes: ${failureModes ? JSON.stringify(failureModes) : "No data"}
${context ? `- Additional Context: ${context}\n` : ""}${
        callsContext ? `\n${callsContext}\n` : ""
      }

When the user asks about a specific error type (for example "unexpected" or "unknown"):
- First, summarize the key insights from the observations (why these calls failed, common themes, user intent patterns, etc.).
- Then, when they ask for follow-up actions, respond with specific, implementation-ready steps (e.g., how to change prompts, routing logic, or tagging rules).
Keep answers concise but insightful.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    const response =
      completion.choices[0].message.content ||
      "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({ response, errorType: inferredErrorType || null });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat message",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


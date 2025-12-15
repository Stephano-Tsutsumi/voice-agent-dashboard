import { NextRequest, NextResponse } from "next/server";
import { savePrompt, getPrompts, getPromptById, deletePrompt } from "@/lib/db";
import { type Prompt } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      const prompt = getPromptById(id);
      if (!prompt) {
        return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
      }
      return NextResponse.json(prompt);
    }

    const prompts = getPrompts();
    return NextResponse.json(prompts);
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const promptData = await request.json();
    const prompt: Prompt = {
      ...promptData,
      createdAt: promptData.createdAt ? new Date(promptData.createdAt) : new Date(),
      updatedAt: new Date(),
    };
    savePrompt(prompt);
    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error("Error saving prompt:", error);
    return NextResponse.json(
      { error: "Failed to save prompt", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Prompt ID required" }, { status: 400 });
    }

    deletePrompt(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}


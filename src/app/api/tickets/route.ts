import { NextRequest, NextResponse } from "next/server";
import { saveTicket, getTicketsByFailureMode } from "@/lib/db";
import { type Ticket } from "@/lib/test-cases";

export async function POST(request: NextRequest) {
  try {
    const ticketData = await request.json();
    const ticket: Ticket = {
      ...ticketData,
      createdAt: new Date(ticketData.createdAt || Date.now()),
      updatedAt: new Date(),
    };
    saveTicket(ticket);
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("Error saving ticket:", error);
    return NextResponse.json(
      { error: "Failed to save ticket", details: error instanceof Error ? error.message : String(error) },
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

    const tickets = getTicketsByFailureMode(failureMode);
    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}


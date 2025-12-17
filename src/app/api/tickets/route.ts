import { NextRequest, NextResponse } from "next/server";
import { saveTicket, getTicketsByFailureMode, getDatabase, deleteTicket } from "@/lib/db";
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
    const getAll = searchParams.get("all");

    if (getAll === "true" || (!failureMode && !getAll)) {
      // Get all tickets
      const database = getDatabase();
      const stmt = database.prepare("SELECT * FROM tickets ORDER BY createdAt DESC");
      const rows = stmt.all() as any[];
      
      const tickets = rows.map((row) => ({
        id: row.id,
        testCaseId: row.testCaseId || undefined,
        failureMode: row.failureMode,
        title: row.title,
        description: row.description,
        priority: row.priority as Ticket["priority"],
        status: row.status as Ticket["status"],
        assignedTo: row.assignedTo || undefined,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
      
      return NextResponse.json(tickets);
    }

    if (failureMode) {
      const tickets = getTicketsByFailureMode(failureMode);
      return NextResponse.json(tickets);
    }
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
    }

    deleteTicket(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}


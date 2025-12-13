import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { type Call, type Annotation } from "./calls";
import { type TestCase, type Ticket } from "./test-cases";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Use absolute path for the database file
  const dbPath = path.join(process.cwd(), "data", "calls.db");
  
  // Ensure the data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      callId TEXT NOT NULL UNIQUE,
      severity TEXT NOT NULL,
      bot TEXT NOT NULL,
      date TEXT NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      sentiment TEXT NOT NULL,
      issues TEXT NOT NULL,
      transcript TEXT,
      history TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      callId TEXT NOT NULL,
      errorType TEXT,
      errorTypeCustom TEXT,
      observations TEXT NOT NULL,
      failureMode TEXT,
      suggestedFix TEXT,
      reviewed INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (callId) REFERENCES calls(callId) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_callId ON calls(callId);
    CREATE INDEX IF NOT EXISTS idx_date ON calls(date);
    CREATE INDEX IF NOT EXISTS idx_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_severity ON calls(severity);
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      failureMode TEXT NOT NULL,
      testCase TEXT NOT NULL,
      steps TEXT NOT NULL,
      expectedResult TEXT,
      actualResult TEXT,
      status TEXT DEFAULT 'draft',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      testCaseId TEXT,
      failureMode TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      assignedTo TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (testCaseId) REFERENCES test_cases(id) ON DELETE SET NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_annotation_callId ON annotations(callId);
    CREATE INDEX IF NOT EXISTS idx_annotation_errorType ON annotations(errorType);
    CREATE INDEX IF NOT EXISTS idx_annotation_failureMode ON annotations(failureMode);
    CREATE INDEX IF NOT EXISTS idx_test_case_failureMode ON test_cases(failureMode);
    CREATE INDEX IF NOT EXISTS idx_ticket_failureMode ON tickets(failureMode);
    CREATE INDEX IF NOT EXISTS idx_ticket_testCaseId ON tickets(testCaseId);
  `);

  // Migrate existing calls table to add history column if it doesn't exist
  try {
    db.exec(`ALTER TABLE calls ADD COLUMN history TEXT`);
  } catch (error: any) {
    // Column already exists, ignore error
    if (!error.message?.includes("duplicate column")) {
      console.warn("Migration warning:", error.message);
    }
  }

  return db;
}

export function saveCall(call: Call): void {
  try {
    const database = getDatabase();
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO calls (
        id, callId, severity, bot, date, duration, status, 
        confidence, sentiment, issues, transcript, history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const dateValue = call.date instanceof Date 
      ? call.date.toISOString() 
      : new Date(call.date).toISOString();
    
    stmt.run(
      call.id,
      call.callId,
      call.severity,
      call.bot,
      dateValue,
      call.duration,
      call.status,
      call.confidence,
      call.sentiment,
      JSON.stringify(call.issues),
      call.transcript || null,
      call.history ? JSON.stringify(call.history) : null
    );
    
    console.log("Call saved to database:", call.callId);
  } catch (error) {
    console.error("Error saving call to database:", error);
    throw error;
  }
}

export function getCalls(): Call[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT c.*, a.id as annotation_id, a.errorType, a.errorTypeCustom, 
           a.observations, a.failureMode, a.suggestedFix, a.reviewed, a.createdAt as annotation_createdAt
    FROM calls c
    LEFT JOIN annotations a ON c.callId = a.callId
    ORDER BY c.date DESC
  `);
  const rows = stmt.all() as any[];
  
  return rows.map((row) => {
    const call: Call = {
      id: row.id,
      callId: row.callId,
      severity: row.severity as Call["severity"],
      bot: row.bot,
      date: new Date(row.date),
      duration: row.duration,
      status: row.status as Call["status"],
      confidence: row.confidence,
      sentiment: row.sentiment as Call["sentiment"],
      issues: JSON.parse(row.issues || "[]"),
      transcript: row.transcript || undefined,
      history: row.history ? JSON.parse(row.history) : undefined,
    };
    
    if (row.annotation_id) {
      call.annotation = {
        id: row.annotation_id,
        errorType: row.errorType as Annotation["errorType"],
        errorTypeCustom: row.errorTypeCustom,
        observations: row.observations,
        failureMode: row.failureMode,
        suggestedFix: row.suggestedFix,
        reviewed: row.reviewed === 1,
        createdAt: row.annotation_createdAt ? new Date(row.annotation_createdAt) : undefined,
      };
    }
    
    return call;
  });
}

export function getCallById(callId: string): Call | null {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT c.*, a.id as annotation_id, a.errorType, a.errorTypeCustom, 
           a.observations, a.failureMode, a.suggestedFix, a.reviewed, a.createdAt as annotation_createdAt
    FROM calls c
    LEFT JOIN annotations a ON c.callId = a.callId
    WHERE c.callId = ?
  `);
  const row = stmt.get(callId) as any;
  
  if (!row) {
    return null;
  }
  
  const call: Call = {
    id: row.id,
    callId: row.callId,
    severity: row.severity as Call["severity"],
    bot: row.bot,
    date: new Date(row.date),
    duration: row.duration,
    status: row.status as Call["status"],
    confidence: row.confidence,
    sentiment: row.sentiment as Call["sentiment"],
    issues: JSON.parse(row.issues || "[]"),
    transcript: row.transcript || undefined,
    history: row.history ? JSON.parse(row.history) : undefined,
  };
  
  if (row.annotation_id) {
    call.annotation = {
      id: row.annotation_id,
      errorType: row.errorType as Annotation["errorType"],
      errorTypeCustom: row.errorTypeCustom,
      observations: row.observations,
      failureMode: row.failureMode,
      suggestedFix: row.suggestedFix,
      reviewed: row.reviewed === 1,
      createdAt: row.annotation_createdAt ? new Date(row.annotation_createdAt) : undefined,
    };
  }
  
  return call;
}

export function searchCalls(query: string): Call[] {
  const database = getDatabase();
  const searchTerm = `%${query}%`;
  const stmt = database.prepare(`
    SELECT c.*, a.id as annotation_id, a.errorType, a.errorTypeCustom, 
           a.observations, a.failureMode, a.suggestedFix, a.reviewed, a.createdAt as annotation_createdAt
    FROM calls c
    LEFT JOIN annotations a ON c.callId = a.callId
    WHERE c.callId LIKE ? 
       OR c.bot LIKE ?
       OR c.transcript LIKE ?
       OR a.observations LIKE ?
    ORDER BY c.date DESC
  `);
  const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm) as any[];
  
  return rows.map((row) => {
    const call: Call = {
      id: row.id,
      callId: row.callId,
      severity: row.severity as Call["severity"],
      bot: row.bot,
      date: new Date(row.date),
      duration: row.duration,
      status: row.status as Call["status"],
      confidence: row.confidence,
      sentiment: row.sentiment as Call["sentiment"],
      issues: JSON.parse(row.issues || "[]"),
      transcript: row.transcript || undefined,
      history: row.history ? JSON.parse(row.history) : undefined,
    };
    
    if (row.annotation_id) {
      call.annotation = {
        id: row.annotation_id,
        errorType: row.errorType as Annotation["errorType"],
        errorTypeCustom: row.errorTypeCustom,
        observations: row.observations,
        failureMode: row.failureMode,
        suggestedFix: row.suggestedFix,
        reviewed: row.reviewed === 1,
        createdAt: row.annotation_createdAt ? new Date(row.annotation_createdAt) : undefined,
      };
    }
    
    return call;
  });
}

export function deleteCall(id: string): void {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM calls WHERE id = ?");
  stmt.run(id);
}

export function saveAnnotation(callId: string, annotation: Annotation): void {
  try {
    const database = getDatabase();
    const annotationId = annotation.id || `${callId}-${Date.now()}`;
    
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO annotations (
        id, callId, errorType, errorTypeCustom, observations, 
        failureMode, suggestedFix, reviewed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      annotationId,
      callId,
      annotation.errorType || null,
      annotation.errorTypeCustom || null,
      annotation.observations,
      annotation.failureMode || null,
      annotation.suggestedFix || null,
      annotation.reviewed ? 1 : 0
    );
    
    console.log("Annotation saved:", annotationId);
  } catch (error) {
    console.error("Error saving annotation:", error);
    throw error;
  }
}

export function getFailureModes(): Array<{ mode: string; count: number }> {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT failureMode as mode, COUNT(*) as count
    FROM annotations
    WHERE failureMode IS NOT NULL AND failureMode != ''
    GROUP BY failureMode
    ORDER BY count DESC
  `);
  return stmt.all() as Array<{ mode: string; count: number }>;
}

export function getCallsByFailureMode(failureMode: string): Call[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT c.*, a.id as annotation_id, a.errorType, a.errorTypeCustom, 
           a.observations, a.failureMode, a.suggestedFix, a.reviewed, a.createdAt as annotation_createdAt
    FROM calls c
    INNER JOIN annotations a ON c.callId = a.callId
    WHERE a.failureMode = ?
    ORDER BY c.date DESC
  `);
  const rows = stmt.all(failureMode) as any[];
  
  return rows.map((row) => {
    const call: Call = {
      id: row.id,
      callId: row.callId,
      severity: row.severity as Call["severity"],
      bot: row.bot,
      date: new Date(row.date),
      duration: row.duration,
      status: row.status as Call["status"],
      confidence: row.confidence,
      sentiment: row.sentiment as Call["sentiment"],
      issues: JSON.parse(row.issues || "[]"),
      transcript: row.transcript || undefined,
      history: row.history ? JSON.parse(row.history) : undefined,
    };
    
    if (row.annotation_id) {
      call.annotation = {
        id: row.annotation_id,
        errorType: row.errorType as Annotation["errorType"],
        errorTypeCustom: row.errorTypeCustom,
        observations: row.observations,
        failureMode: row.failureMode,
        suggestedFix: row.suggestedFix,
        reviewed: row.reviewed === 1,
        createdAt: row.annotation_createdAt ? new Date(row.annotation_createdAt) : undefined,
      };
    }
    
    return call;
  });
}

export function getErrorTypeDistribution(): Array<{ type: string; count: number }> {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT COALESCE(errorType, errorTypeCustom, 'unclassified') as type, COUNT(*) as count
    FROM annotations
    GROUP BY type
    ORDER BY count DESC
  `);
  return stmt.all() as Array<{ type: string; count: number }>;
}

export function saveTestCase(testCase: TestCase): void {
  try {
    const database = getDatabase();
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO test_cases (
        id, failureMode, testCase, steps, expectedResult, actualResult, status, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      testCase.id,
      testCase.failureMode,
      testCase.testCase,
      testCase.steps,
      testCase.expectedResult || null,
      testCase.actualResult || null,
      testCase.status,
    );
    
    console.log("Test case saved:", testCase.id);
  } catch (error) {
    console.error("Error saving test case:", error);
    throw error;
  }
}

export function getTestCasesByFailureMode(failureMode: string): TestCase[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM test_cases
    WHERE failureMode = ?
    ORDER BY createdAt DESC
  `);
  const rows = stmt.all(failureMode) as any[];
  
  return rows.map((row) => ({
    id: row.id,
    failureMode: row.failureMode,
    testCase: row.testCase,
    steps: row.steps,
    expectedResult: row.expectedResult || undefined,
    actualResult: row.actualResult || undefined,
    status: row.status as TestCase["status"],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

export function saveTicket(ticket: Ticket): void {
  try {
    const database = getDatabase();
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO tickets (
        id, testCaseId, failureMode, title, description, priority, status, assignedTo, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      ticket.id,
      ticket.testCaseId || null,
      ticket.failureMode,
      ticket.title,
      ticket.description,
      ticket.priority,
      ticket.status,
      ticket.assignedTo || null,
    );
    
    console.log("Ticket saved:", ticket.id);
  } catch (error) {
    console.error("Error saving ticket:", error);
    throw error;
  }
}

export function getTicketsByFailureMode(failureMode: string): Ticket[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM tickets
    WHERE failureMode = ?
    ORDER BY createdAt DESC
  `);
  const rows = stmt.all(failureMode) as any[];
  
  return rows.map((row) => ({
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
}

export function getCallsByErrorType(errorType: string): Call[] {
  const database = getDatabase();
  
  // Handle "unclassified" case - calls with no annotation
  if (errorType === "unclassified") {
    const stmt = database.prepare(`
      SELECT c.*, NULL as annotation_id, NULL as errorType, NULL as errorTypeCustom,
             NULL as observations, NULL as failureMode, NULL as suggestedFix, NULL as reviewed, NULL as annotation_createdAt
      FROM calls c
      LEFT JOIN annotations a ON c.callId = a.callId
      WHERE a.id IS NULL
      ORDER BY c.date DESC
    `);
    const rows = stmt.all() as any[];
    
    return rows.map((row) => ({
      id: row.id,
      callId: row.callId,
      severity: row.severity as Call["severity"],
      bot: row.bot,
      date: new Date(row.date),
      duration: row.duration,
      status: row.status as Call["status"],
      confidence: row.confidence,
      sentiment: row.sentiment as Call["sentiment"],
      issues: JSON.parse(row.issues || "[]"),
      transcript: row.transcript || undefined,
      history: row.history ? JSON.parse(row.history) : undefined,
    }));
  }
  
  // Handle regular error types
  const stmt = database.prepare(`
    SELECT c.*, a.id as annotation_id, a.errorType, a.errorTypeCustom,
           a.observations, a.failureMode, a.suggestedFix, a.reviewed, a.createdAt as annotation_createdAt
    FROM calls c
    INNER JOIN annotations a ON c.callId = a.callId
    WHERE a.errorType = ? OR a.errorTypeCustom = ?
    ORDER BY c.date DESC
  `);
  const rows = stmt.all(errorType, errorType) as any[];
  
  return rows.map((row) => {
    const call: Call = {
      id: row.id,
      callId: row.callId,
      severity: row.severity as Call["severity"],
      bot: row.bot,
      date: new Date(row.date),
      duration: row.duration,
      status: row.status as Call["status"],
      confidence: row.confidence,
      sentiment: row.sentiment as Call["sentiment"],
      issues: JSON.parse(row.issues || "[]"),
      transcript: row.transcript || undefined,
      history: row.history ? JSON.parse(row.history) : undefined,
    };
    
    if (row.annotation_id) {
      call.annotation = {
        id: row.annotation_id,
        errorType: row.errorType as Annotation["errorType"],
        errorTypeCustom: row.errorTypeCustom,
        observations: row.observations,
        failureMode: row.failureMode,
        suggestedFix: row.suggestedFix,
        reviewed: row.reviewed === 1,
        createdAt: row.annotation_createdAt ? new Date(row.annotation_createdAt) : undefined,
      };
    }
    
    return call;
  });
}


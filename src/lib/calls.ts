export type CallSeverity = "Low" | "Medium" | "High";
export type CallStatus = "Completed" | "Escalated" | "Failed";
export type CallSentiment = "positive" | "neutral" | "negative";

export type ErrorType =
  | "tone_mismatch"
  | "missing_information"
  | "incorrect_response"
  | "technical_error"
  | "timeout"
  | "user_confusion"
  | "hallucination"
  | "ext_transfer"
  | "csr_transfer"
  | "expected"
  | "unexpected"
  | "unknown"
  | "other";

export interface Annotation {
  id?: string;
  errorType?: ErrorType;
  errorTypeCustom?: string;
  observations: string;
  failureMode?: string;
  suggestedFix?: string;
  reviewed?: boolean;
  createdAt?: Date;
}

export interface Call {
  id: string;
  callId: string;
  severity: CallSeverity;
  bot: string;
  date: Date;
  duration: number;
  status: CallStatus;
  confidence: number;
  sentiment: CallSentiment;
  issues: string[];
  transcript?: string;
  annotation?: Annotation;
  history?: any[];
}

// ------- Metrics & utility helpers used on the client -------

export function calculateConfidence(history: any[]): number {
  if (!Array.isArray(history) || history.length === 0) return 0;
  const successfulInteractions = history.filter(
    (item) => item.type === "message" && item.role === "assistant"
  ).length;
  return Math.min(100, Math.round((successfulInteractions / history.length) * 100));
}

export function calculateSentiment(history: any[]): CallSentiment {
  // Placeholder sentiment logic – can be replaced with real NLP later
  const assistantMessages = Array.isArray(history)
    ? history.filter((item) => item.type === "message" && item.role === "assistant")
    : [];
  if (assistantMessages.length === 0) return "neutral";
  return "neutral";
}

export function calculateSeverity(
  confidence: number,
  status: CallStatus,
  issues: string[]
): CallSeverity {
  if (status === "Failed" || confidence < 40) return "High";
  if (status === "Escalated" || confidence < 60 || issues.length > 0) return "Medium";
  return "Low";
}

export function detectIssues(history: any[], status: CallStatus): string[] {
  const issues: string[] = [];

  if (status === "Failed") {
    issues.push("FALLBA");
  }
  if (status === "Escalated") {
    issues.push("ESCALA");
  }

  const confidence = calculateConfidence(history || []);
  if (confidence < 50) {
    issues.push("LOW CONFID");
  }

  return issues;
}

// Generate a human-readable call ID based on current calls in the system.
// Falls back to a random ID if the API is unavailable.
export async function generateCallId(): Promise<string> {
  try {
    const response = await fetch("/api/calls");
    if (!response.ok) throw new Error("Failed to fetch calls");
    const calls: Call[] = await response.json();
    const num = (Array.isArray(calls) ? calls.length : 0) + 1;
    return `INT-2024-${String(num).padStart(6, "0")}`;
  } catch {
    const num = Math.floor(Math.random() * 1_000_000) + 1;
    return `INT-2024-${String(num).padStart(6, "0")}`;
  }
}




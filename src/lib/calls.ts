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
  | "other";

export interface Annotation {
  id?: string;
  errorType?: ErrorType;
  errorTypeCustom?: string;
  observations: string;
  failureMode?: string; // AI-categorized failure mode
  suggestedFix?: string; // AI-suggested fix
  reviewed?: boolean; // Human reviewed the AI categorization
  createdAt?: Date;
}

export interface Call {
  id: string;
  callId: string;
  severity: CallSeverity;
  bot: string;
  date: Date;
  duration: number; // in seconds
  status: CallStatus;
  confidence: number; // 0-100
  sentiment: CallSentiment;
  issues: string[];
  transcript?: string;
  annotation?: Annotation;
  history?: any[]; // Full call history for detailed view
}

// Store calls in localStorage for persistence
const STORAGE_KEY = "voice-agent-calls";

export function saveCall(call: Call): void {
  const calls = getCalls();
  calls.push(call);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
}

export function getCalls(): Call[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const calls = JSON.parse(stored);
  // Convert date strings back to Date objects
  return calls.map((call: any) => ({
    ...call,
    date: new Date(call.date),
  }));
}

export function deleteCall(id: string): void {
  const calls = getCalls();
  const filtered = calls.filter((call) => call.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function generateCallId(): Promise<string> {
  try {
    const response = await fetch("/api/calls");
    const calls = await response.json();
    const num = calls.length + 1;
    return `INT-2024-${String(num).padStart(6, "0")}`;
  } catch (error) {
    // Fallback if API is not available
    const num = Math.floor(Math.random() * 1000000) + 1;
    return `INT-2024-${String(num).padStart(6, "0")}`;
  }
}

// Calculate metrics from call history
export function calculateConfidence(history: any[]): number {
  // Simple calculation based on successful interactions
  // In a real app, this would be more sophisticated
  if (history.length === 0) return 0;
  const successfulInteractions = history.filter(
    (item) => item.type === "message" && item.role === "assistant"
  ).length;
  return Math.min(100, Math.round((successfulInteractions / history.length) * 100));
}

export function calculateSentiment(history: any[]): CallSentiment {
  // Simple sentiment calculation
  // In a real app, this would use NLP
  const assistantMessages = history.filter(
    (item) => item.type === "message" && item.role === "assistant"
  );
  if (assistantMessages.length === 0) return "neutral";
  // For now, return neutral - could be enhanced with actual sentiment analysis
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
  
  // Check for low confidence
  const confidence = calculateConfidence(history);
  if (confidence < 50) {
    issues.push("LOW CONFID");
  }
  
  // Check for API errors (would need to track these)
  // For now, we'll add placeholder issues
  
  return issues;
}


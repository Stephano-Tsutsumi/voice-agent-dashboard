export interface TestCase {
  id: string;
  failureMode: string;
  testCase: string;
  steps: string;
  expectedResult?: string;
  actualResult?: string;
  status: "draft" | "ready" | "tested" | "reproduced";
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  testCaseId?: string;
  failureMode: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}


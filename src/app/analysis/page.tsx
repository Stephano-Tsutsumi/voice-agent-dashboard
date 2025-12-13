"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Call, type Annotation } from "@/lib/calls";
import { CallDetailModal } from "@/components/call-detail-modal";
import { type TestCase, type Ticket } from "@/lib/test-cases";

interface FailureMode {
  mode: string;
  count: number;
}

interface ErrorDistribution {
  type: string;
  count: number;
}

export default function AnalysisPage() {
  const [failureModes, setFailureModes] = useState<FailureMode[]>([]);
  const [errorDistribution, setErrorDistribution] = useState<ErrorDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedErrorType, setSelectedErrorType] = useState<string | null>(null);
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [selectedFailureMode, setSelectedFailureMode] = useState<string | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isGeneratingTestCase, setIsGeneratingTestCase] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [problemDescription, setProblemDescription] = useState("");

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      setIsLoading(true);
      const [modesRes, distRes] = await Promise.all([
        fetch("/api/annotations?type=failure-modes"),
        fetch("/api/annotations?type=error-distribution"),
      ]);

      const modes = await modesRes.json();
      const dist = await distRes.json();

      setFailureModes(modes);
      setErrorDistribution(dist);
    } catch (error) {
      console.error("Failed to fetch analysis:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleErrorTypeClick = async (errorType: string) => {
    setSelectedErrorType(errorType);
    setIsLoadingCalls(true);
    try {
      const response = await fetch(`/api/annotations?errorType=${encodeURIComponent(errorType)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch calls");
      }
      const calls: Call[] = await response.json();
      setFilteredCalls(calls);
    } catch (error) {
      console.error("Failed to fetch calls by error type:", error);
      setFilteredCalls([]);
    } finally {
      setIsLoadingCalls(false);
    }
  };

  const handleSaveAnnotation = async (callId: string, annotation: Annotation) => {
    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, annotation }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save annotation");
      }
      
      // Refresh filtered calls if we're viewing an error type
      if (selectedErrorType) {
        await handleErrorTypeClick(selectedErrorType);
      }
    } catch (error) {
      console.error("Failed to save annotation:", error);
      throw error;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const formatDate = (date: Date | string): string => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch {
      return String(date);
    }
  };

  const handleFailureModeClick = async (failureMode: string) => {
    setSelectedFailureMode(failureMode);
    // Fetch test cases and tickets for this failure mode
    try {
      const [testCasesRes, ticketsRes] = await Promise.all([
        fetch(`/api/test-cases?failureMode=${encodeURIComponent(failureMode)}`),
        fetch(`/api/tickets?failureMode=${encodeURIComponent(failureMode)}`),
      ]);
      
      if (testCasesRes.ok) {
        const testCasesData = await testCasesRes.json();
        setTestCases(testCasesData);
      }
      
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error("Failed to fetch test cases/tickets:", error);
    }
  };

  const handleGenerateTestCase = async (failureMode: string) => {
    setIsGeneratingTestCase(true);
    try {
      // Get example calls with this failure mode
      const callsResponse = await fetch(`/api/calls?failureMode=${encodeURIComponent(failureMode)}`);
      let exampleCalls: Call[] = [];
      if (callsResponse.ok) {
        exampleCalls = (await callsResponse.json()).slice(0, 3);
      }
      
      const observations = exampleCalls
        .map((call) => call.annotation?.observations)
        .filter(Boolean);

      const response = await fetch("/api/ai/generate-test-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failureMode,
          observations,
          exampleCalls: exampleCalls.map((call) => ({
            callId: call.callId,
            transcript: call.transcript,
            annotation: call.annotation,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate test case");
      }

      const data = await response.json();
      
      // Save test case
      const testCase: TestCase = {
        id: `tc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        failureMode,
        testCase: data.testCase,
        steps: data.steps,
        expectedResult: data.expectedResult,
        actualResult: data.actualResult,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fetch("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testCase),
      });

      // Refresh test cases
      await handleFailureModeClick(failureMode);
    } catch (error) {
      console.error("Failed to generate test case:", error);
      alert("Failed to generate test case. Please try again.");
    } finally {
      setIsGeneratingTestCase(false);
    }
  };

  const handleCreateTicket = async (testCase: TestCase) => {
    if (!problemDescription.trim()) {
      alert("Please describe the problem/bug before creating a ticket.");
      return;
    }

    setIsCreatingTicket(true);
    try {
      const response = await fetch("/api/ai/create-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failureMode: testCase.failureMode,
          testCase: {
            description: testCase.testCase,
            steps: testCase.steps,
            expectedResult: testCase.expectedResult,
            actualResult: testCase.actualResult,
          },
          problemDescription,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }

      const data = await response.json();
      
      // Save ticket
      const ticket: Ticket = {
        id: `ticket_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        testCaseId: testCase.id,
        failureMode: testCase.failureMode,
        title: data.title,
        description: data.description,
        priority: data.priority || "medium",
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticket),
      });

      // Refresh tickets and clear form
      await handleFailureModeClick(testCase.failureMode);
      setProblemDescription("");
      setSelectedTestCase(null);
    } catch (error) {
      console.error("Failed to create ticket:", error);
      alert("Failed to create ticket. Please try again.");
    } finally {
      setIsCreatingTicket(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white p-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white dark:text-white">Error Analysis</h1>
            <p className="text-gray-400 dark:text-gray-400">Analyze failure modes and error patterns</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="outline" className="border-gray-800 bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Back to Dashboard
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading analysis...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Failure Modes */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Failure Modes</h2>
              {failureModes.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No failure modes identified yet. Annotate calls to see patterns.</p>
              ) : (
                <div className="space-y-3">
                  {failureModes.map((mode, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleFailureModeClick(mode.mode)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-gray-900 dark:text-white">{mode.mode}</span>
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {mode.count} {mode.count === 1 ? "case" : "cases"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Type Distribution */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Error Type Distribution</h2>
              {errorDistribution.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No error types recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {errorDistribution.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleErrorTypeClick(item.type)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-gray-900 dark:text-white capitalize">{item.type.replace(/_/g, " ")}</span>
                      <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                        {item.count} {item.count === 1 ? "call" : "calls"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filtered Calls View */}
        {selectedErrorType && (
          <div className="mt-8 border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Calls with "{selectedErrorType.replace(/_/g, " ")}" Error
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {filteredCalls.length} {filteredCalls.length === 1 ? "call" : "calls"} found
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedErrorType(null);
                  setFilteredCalls([]);
                }}
                className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Close
              </Button>
            </div>

            {isLoadingCalls ? (
              <div className="text-center py-8 text-gray-400">Loading calls...</div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No calls found with this error type.</div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Call ID</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Duration</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Status</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Observations</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.map((call) => (
                      <TableRow
                        key={call.id}
                        className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {call.callId}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(call.date)}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {formatDuration(call.duration)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              call.status === "Completed"
                                ? "bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                                : call.status === "Failed"
                                ? "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                                : "bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400"
                            }
                          >
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-md truncate">
                          {call.annotation?.observations || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCall(call)}
                            className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Failure Mode Details View */}
        {selectedFailureMode && (
          <div className="mt-8 border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Failure Mode: {selectedFailureMode}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Generate test cases and create tickets for this failure mode
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleGenerateTestCase(selectedFailureMode)}
                  disabled={isGeneratingTestCase}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isGeneratingTestCase ? "Generating..." : "🤖 Generate Test Case"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFailureMode(null);
                    setTestCases([]);
                    setTickets([]);
                  }}
                  className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Test Cases */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Test Cases</h3>
              {testCases.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No test cases yet. Click "Generate Test Case" to create one.</p>
              ) : (
                <div className="space-y-4">
                  {testCases.map((testCase) => (
                    <div key={testCase.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{testCase.testCase}</h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Steps:</span>
                              <pre className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans">{testCase.steps}</pre>
                            </div>
                            {testCase.expectedResult && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Expected:</span>
                                <p className="mt-1 text-gray-600 dark:text-gray-400">{testCase.expectedResult}</p>
                              </div>
                            )}
                            {testCase.actualResult && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Actual:</span>
                                <p className="mt-1 text-gray-600 dark:text-gray-400">{testCase.actualResult}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-4">
                          {testCase.status}
                        </Badge>
                      </div>
                      
                      {/* Create Ticket Section */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2">Create Ticket</h5>
                        <textarea
                          value={selectedTestCase?.id === testCase.id ? problemDescription : ""}
                          onChange={(e) => {
                            setProblemDescription(e.target.value);
                            setSelectedTestCase(testCase);
                          }}
                          placeholder="Describe the problem/bug you found when testing..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
                        />
                        <Button
                          onClick={() => handleCreateTicket(testCase)}
                          disabled={isCreatingTicket || !problemDescription.trim() || selectedTestCase?.id !== testCase.id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isCreatingTicket ? "Creating..." : "🤖 Create Ticket"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tickets */}
            {tickets.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Tickets</h3>
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{ticket.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 whitespace-pre-wrap">{ticket.description}</p>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                              {ticket.priority}
                            </Badge>
                            <Badge variant="outline">
                              {ticket.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Call Detail Modal */}
        {selectedCall && (
          <CallDetailModal
            call={selectedCall}
            onClose={() => setSelectedCall(null)}
            onSaveAnnotation={handleSaveAnnotation}
          />
        )}
      </div>
    </div>
  );
}


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
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isGeneratingTestCase, setIsGeneratingTestCase] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [problemDescription, setProblemDescription] = useState("");
  const [showCreateFailureMode, setShowCreateFailureMode] = useState(false);
  const [newFailureMode, setNewFailureMode] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showTestCaseManagement, setShowTestCaseManagement] = useState(false);

  useEffect(() => {
    fetchAnalysis();
    fetchAllTestCases();
  }, []);

  const fetchAllTestCases = async () => {
    try {
      const response = await fetch("/api/test-cases?all=true");
      if (response.ok) {
        const data = await response.json();
        // Ensure dates are Date objects
        const testCasesWithDates = data.map((tc: any) => ({
          ...tc,
          createdAt: tc.createdAt ? new Date(tc.createdAt) : new Date(),
          updatedAt: tc.updatedAt ? new Date(tc.updatedAt) : new Date(),
        }));
        setAllTestCases(testCasesWithDates);
      }
    } catch (error) {
      console.error("Failed to fetch test cases:", error);
    }
  };

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
  };

  const handleGenerateTestCase = async (failureMode: string) => {
    setIsGeneratingTestCase(true);
    try {
      // Get example calls with this failure mode
      const callsResponse = await fetch(`/api/calls?failureMode=${encodeURIComponent(failureMode)}`);
      let exampleCalls: Call[] = [];
      if (callsResponse.ok) {
        const calls = await callsResponse.json();
        exampleCalls = Array.isArray(calls) ? calls.slice(0, 3) : [];
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
            transcript: call.transcript || "",
            annotation: call.annotation,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate test case");
      }

      const data = await response.json();
      
      // Validate response has required fields
      if (!data.testCase && !data.test_case) {
        throw new Error("Invalid test case response: missing testCase field");
      }
      
      // Save test case
      const testCase: TestCase = {
        id: `tc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        failureMode: failureMode.replace(/\s+/g, "_").toLowerCase(),
        testCase: data.testCase || data.test_case || "Test case",
        steps: typeof data.steps === 'string' ? data.steps : JSON.stringify(data.steps),
        expectedResult: data.expectedResult || data.expected_result || undefined,
        actualResult: data.actualResult || data.actual_result || undefined,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const saveResponse = await fetch("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testCase),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save test case");
      }

      // Refresh all test cases and add to chat
      await fetchAllTestCases();
      setChatMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: `✅ Test case generated and saved!\n\n**Test Case:** ${data.testCase}\n\n**Steps:**\n${data.steps}\n\nYou can view and manage all test cases using the "Manage Test Cases" button.` 
        },
      ]);
    } catch (error) {
      console.error("Failed to generate test case:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setChatMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: `❌ Failed to generate test case: ${errorMessage}\n\nPlease check:\n1. OpenAI API key is set\n2. The failure mode is valid\n3. Try asking in a different way, e.g., "Generate a test case for tone mismatch"` 
        },
      ]);
    } finally {
      setIsGeneratingTestCase(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          errorDistribution,
          failureModes,
          context: selectedFailureMode ? `Currently viewing failure mode: ${selectedFailureMode}` : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get chat response");
      }

      const data = await response.json();
      const assistantResponse = data.response;
      setChatMessages((prev) => [...prev, { role: "assistant", content: assistantResponse }]);

      // Try to extract test case from JSON in the response
      const jsonMatch = assistantResponse.match(/\{[\s\S]*"test_case[\s\S]*\}/) || 
                       assistantResponse.match(/\{[\s\S]*"testCase[\s\S]*\}/) ||
                       assistantResponse.match(/\{[\s\S]*"steps[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          // Check if it's a test case structure
          if (parsed.testCase || parsed.test_case || parsed.steps) {
            // Extract failure mode from user message or response
            const failureModeMatch = userMessage.match(/(?:for|about|on|tone mismatch|tone_mismatch|error|failure)[:\s]+([^\?\.\n]+)/i) ||
                                    assistantResponse.match(/failure mode[:\s]+([^\n,\.]+)/i) ||
                                    assistantResponse.match(/tone[_\s]?mismatch/i);
            
            const failureMode = failureModeMatch 
              ? failureModeMatch[1]?.trim().replace(/['"]/g, "") || "tone_mismatch"
              : errorDistribution.length > 0 
              ? errorDistribution[0].type 
              : "general_failure";
            
            // Save the test case
            const testCaseData = parsed.testCase || parsed.test_case || parsed.description || "Test case from chat";
            const stepsData = parsed.steps || 
                            (Array.isArray(parsed.steps) ? parsed.steps.map((s: any) => 
                              typeof s === 'string' ? s : s.step_description || s.description || JSON.stringify(s)
                            ).join("\n") : JSON.stringify(parsed.steps));
            
            const testCase: TestCase = {
              id: `tc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              failureMode: failureMode.replace(/\s+/g, "_").toLowerCase(),
              testCase: typeof testCaseData === 'string' ? testCaseData : JSON.stringify(testCaseData),
              steps: typeof stepsData === 'string' ? stepsData : JSON.stringify(stepsData),
              expectedResult: parsed.expectedResult || parsed.expected_result || parsed.expected || undefined,
              actualResult: parsed.actualResult || parsed.actual_result || parsed.actual || undefined,
              status: "draft",
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const saveResponse = await fetch("/api/test-cases", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(testCase),
            });

            if (saveResponse.ok) {
              await fetchAllTestCases();
              setChatMessages((prev) => [
                ...prev.slice(0, -1), // Remove last message
                { 
                  role: "assistant", 
                  content: `${assistantResponse}\n\n✅ **Test case automatically saved to management!**` 
                },
              ]);
            }
          }
        } catch (parseError) {
          // If JSON parsing fails, check if user explicitly asked for test case generation
          const wantsTestCase = userMessage.toLowerCase().includes("test case") || 
                               userMessage.toLowerCase().includes("generate test") ||
                               userMessage.toLowerCase().includes("create test");
          
          if (wantsTestCase) {
            // Try to extract failure mode and generate
            const failureModeMatch = userMessage.match(/(?:for|about|on)[:\s]+([^\?\.\n]+)/i) ||
                                    assistantResponse.match(/failure mode[:\s]+([^\n,\.]+)/i);
            const failureMode = failureModeMatch ? failureModeMatch[1].trim().replace(/\s+/g, "_").toLowerCase() : 
                               errorDistribution.length > 0 ? errorDistribution[0].type : 
                               "general_failure";
            
            await handleGenerateTestCase(failureMode);
          }
        }
      } else {
        // Check if user wants to generate test cases
        const wantsTestCase = userMessage.toLowerCase().includes("test case") || 
                             userMessage.toLowerCase().includes("generate test") ||
                             userMessage.toLowerCase().includes("create test");
        
        if (wantsTestCase) {
          // Try to extract failure mode from response or user message
          const failureModeMatch = userMessage.match(/(?:for|about|on)[:\s]+([^\?\.\n]+)/i) ||
                                  assistantResponse.match(/failure mode[:\s]+([^\n,\.]+)/i);
          const failureMode = failureModeMatch ? failureModeMatch[1].trim().replace(/\s+/g, "_").toLowerCase() : 
                             errorDistribution.length > 0 ? errorDistribution[0].type : 
                             "general_failure";
          
          if (failureMode) {
            // Generate test case directly
            await handleGenerateTestCase(failureMode);
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExportTestCases = (format: "csv" | "txt", testCasesToExport?: TestCase[]) => {
    const casesToExport = testCasesToExport || allTestCases;
    if (casesToExport.length === 0) {
      alert("No test cases to export");
      return;
    }

    let content = "";
    let filename = "";

    if (format === "csv") {
      // CSV format
      const headers = ["ID", "Failure Mode", "Test Case", "Steps", "Expected Result", "Actual Result", "Status"];
      const rows = casesToExport.map((tc) => [
        tc.id,
        tc.failureMode,
        tc.testCase,
        tc.steps.replace(/\n/g, " | "),
        tc.expectedResult || "",
        tc.actualResult || "",
        tc.status,
      ]);
      
      content = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      filename = `test-cases-${Date.now()}.csv`;
    } else {
      // Text format
      content = casesToExport.map((tc, idx) => {
        return `Test Case ${idx + 1}
${"=".repeat(50)}
ID: ${tc.id}
Failure Mode: ${tc.failureMode}
Status: ${tc.status}
Created: ${tc.createdAt.toLocaleString()}

Description:
${tc.testCase}

Steps to Reproduce:
${tc.steps}

Expected Result:
${tc.expectedResult || "N/A"}

Actual Result:
${tc.actualResult || "N/A"}

${"=".repeat(50)}

`;
      }).join("\n");
      filename = `test-cases-${Date.now()}.txt`;
    }

    // Download file
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      await fetchAllTestCases();
      setProblemDescription("");
      setSelectedTestCase(null);
      
      // Add success message to chat
      setChatMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: `✅ Ticket created successfully!\n\n**Title:** ${ticket.title}\n**Priority:** ${ticket.priority}\n**Status:** ${ticket.status}\n\nYou can view all tickets in the test case management section.` 
        },
      ]);
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
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Error Analysis</h1>
            <p className="text-gray-600 dark:text-gray-400">Analyze failure modes and error patterns</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowTestCaseManagement(!showTestCaseManagement)}
              variant="outline"
              className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {showTestCaseManagement ? "Hide" : "Manage Test Cases"} ({allTestCases.length})
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                Back to Dashboard
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading analysis...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat UI for Failure Mode Analysis */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a] flex flex-col h-[600px]">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Failure Mode Analysis</h2>
              
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-gray-600 dark:text-gray-400 text-sm space-y-2">
                    <p>Ask me about failure modes based on your error distribution!</p>
                    <p className="font-semibold text-gray-900 dark:text-white">Try asking:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>"What are the common failure modes based on my error distribution?"</li>
                      <li>"Generate test cases for tone mismatch failures"</li>
                      <li>"What patterns do you see in my errors?"</li>
                    </ul>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-sm text-gray-700 dark:text-gray-400">Thinking...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder="Ask about failure modes or generate test cases..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  disabled={isChatLoading}
                />
                <Button
                  onClick={handleChatSend}
                  disabled={isChatLoading || !chatInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Send
                </Button>
              </div>
            </div>

            {/* Error Type Distribution */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Error Type Distribution</h2>
              {errorDistribution.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No error types recorded yet.</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading calls...</div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">No calls found with this error type.</div>
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
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
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

        {/* Test Case Management View */}
        {showTestCaseManagement && (
          <div className="mt-8 border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Test Case Management</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  View, manage, and export all saved test cases
                </p>
              </div>
              <div className="flex gap-2">
                {allTestCases.length > 0 && (
                  <>
                    <Button
                      onClick={() => handleExportTestCases("csv")}
                      variant="outline"
                      size="sm"
                      className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      📥 Export All CSV
                    </Button>
                    <Button
                      onClick={() => handleExportTestCases("txt")}
                      variant="outline"
                      size="sm"
                      className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      📥 Export All TXT
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowTestCaseManagement(false)}
                  className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Close
                </Button>
              </div>
            </div>

            {allTestCases.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                No test cases saved yet. Use the chat to generate test cases and they will be automatically saved here.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  allTestCases.reduce((acc, tc) => {
                    const key = tc.failureMode || "uncategorized";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(tc);
                    return acc;
                  }, {} as Record<string, TestCase[]>)
                ).map(([failureMode, testCases]) => (
                  <div key={failureMode} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white capitalize">
                      {failureMode.replace(/_/g, " ")} ({testCases.length} {testCases.length === 1 ? "test case" : "test cases"})
                    </h3>
                    <div className="space-y-4">
                      {testCases.map((testCase) => (
                        <div key={testCase.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-[#0a0a0a]">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">{testCase.testCase}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {testCase.status}
                                </Badge>
                              </div>
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
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  Created: {testCase.createdAt.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex gap-2">
                            <Button
                              onClick={() => handleExportTestCases("csv", [testCase])}
                              variant="outline"
                              size="sm"
                              className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              📥 Export CSV
                            </Button>
                            <Button
                              onClick={() => handleExportTestCases("txt", [testCase])}
                              variant="outline"
                              size="sm"
                              className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              📥 Export TXT
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedTestCase(testCase);
                                setShowTestCaseManagement(false);
                                setChatInput(`Create a ticket for test case: ${testCase.testCase}`);
                              }}
                              variant="outline"
                              size="sm"
                              className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              🎫 Create Ticket
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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


"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { type Call, CallSeverity, CallStatus, type Annotation } from "@/lib/calls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { CallDetailModal } from "@/components/call-detail-modal";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatDate(date: Date | string): string {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(dateObj);
  } catch (error) {
    console.error("Error formatting date:", error, date);
    return "Invalid date";
  }
}

function getSeverityBadge(severity: CallSeverity) {
  const variants: Record<CallSeverity, { label: string; className: string }> = {
    Low: { label: "✔ Low", className: "bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/50" },
    Medium: { label: "ⓘ Medium", className: "bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/50" },
    High: { label: "▲ High", className: "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/50" },
  };
  return variants[severity];
}

function getStatusBadge(status: CallStatus) {
  const variants: Record<CallStatus, { label: string; className: string }> = {
    Completed: { label: "✔ Completed", className: "bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/50" },
    Escalated: { label: "⇄ Escalated", className: "bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/50" },
    Failed: { label: "ⓧ Failed", className: "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/50" },
  };
  return variants[status];
}

function getSentimentEmoji(sentiment: string) {
  const emojis: Record<string, string> = {
    positive: "😊",
    neutral: "😐",
    negative: "😞",
  };
  return emojis[sentiment] || "😐";
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "bg-green-500";
  if (confidence >= 50) return "bg-orange-500";
  return "bg-red-500";
}

export default function Dashboard() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const fetchCalls = async (search?: string) => {
    try {
      const url = search
        ? `/api/calls?search=${encodeURIComponent(search)}`
        : "/api/calls";
      const response = await fetch(url);
      const data = await response.json();
      
      // Convert date strings to Date objects
      const callsWithDates = data.map((call: any) => ({
        ...call,
        date: call.date instanceof Date ? call.date : new Date(call.date),
      }));
      
      setCalls(callsWithDates);
    } catch (error) {
      console.error("Failed to fetch calls:", error);
    }
  };

  useEffect(() => {
    fetchCalls();
    // Refresh every 2 seconds to get new calls
    const interval = setInterval(() => {
      if (!isSearching) {
        fetchCalls();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isSearching]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      fetchCalls(searchQuery.trim());
    } else {
      setIsSearching(false);
      fetchCalls();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    fetchCalls();
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
      
      // Refresh calls to get updated annotations
      await fetchCalls();
    } catch (error) {
      console.error("Failed to save annotation:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white p-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Calls Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Monitor and analyze voice agent performance</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/rag-upload">
              <Button variant="outline" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">Upload Docs</Button>
            </Link>
            <Link href="/analysis">
              <Button variant="outline" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">Analysis</Button>
            </Link>
            <ThemeToggle />
            <Link href="/">
              <Button variant="outline" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300">New Call</Button>
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Call ID, Bot, or transcript..."
              className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600"
            />
            <Button
              type="submit"
              variant="outline"
              className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300"
            >
              Search
            </Button>
            {isSearching && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearSearch}
                className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Clear
              </Button>
            )}
          </form>
          {isSearching && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Showing {calls.length} result{calls.length !== 1 ? "s" : ""} for "{searchQuery}"
            </p>
          )}
        </div>

        {/* Saved Views */}
        <div className="flex gap-2 mb-6">
          <Button variant="default" size="sm" className="bg-gray-700 dark:bg-gray-700 text-white hover:bg-gray-600 dark:hover:bg-gray-600 border-gray-600 dark:border-gray-600">All Calls</Button>
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300">Training Issues</Button>
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300">API Errors Only</Button>
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300">High Severity</Button>
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300">+ New View</Button>
        </div>

        {/* Calls Table */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-[#0a0a0a]">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 dark:border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Call ID</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">SEVERITY</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">BOT</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">Date</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">DURATION</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">STATUS</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">CONFIDENCE</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">SENTIMENT</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">ISSUES</TableHead>
                <TableHead className="text-gray-600 dark:text-gray-400 font-semibold">ANNOTATED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-600 dark:text-gray-400 py-8">
                    No calls yet. Start a new call to see it here.
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((call) => {
                  const severityBadge = getSeverityBadge(call.severity);
                  const statusBadge = getStatusBadge(call.status);
                  
                  return (
                    <TableRow 
                      key={call.id} 
                      className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer"
                      onClick={() => setSelectedCall(call)}
                    >
                      <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">{call.callId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={severityBadge.className}>
                          {severityBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{call.bot}</TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">{formatDate(call.date)}</TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{formatDuration(call.duration)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                call.confidence >= 80
                                  ? "bg-green-500"
                                  : call.confidence >= 50
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${call.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-10">{call.confidence}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-2xl">{getSentimentEmoji(call.sentiment)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {call.issues.length === 0 ? (
                            <span className="text-xs text-gray-600 dark:text-gray-400">No issue</span>
                          ) : (
                            <>
                              {call.issues.slice(0, 3).map((issue, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                                >
                                  {issue}
                                </Badge>
                              ))}
                              {call.issues.length > 3 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                                >
                                  +{call.issues.length - 3}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.annotation ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                          >
                            {call.annotation.reviewed ? "✓ Reviewed" : "📝 Annotated"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onSaveAnnotation={handleSaveAnnotation}
        />
      )}
    </div>
  );
}


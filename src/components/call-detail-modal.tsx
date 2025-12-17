"use client";

import React, { useState, useEffect } from "react";
import { type Call, type Annotation, type ErrorType } from "@/lib/calls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CallDetailModalProps {
  call: Call | null;
  onClose: () => void;
  onSaveAnnotation: (callId: string, annotation: Annotation) => Promise<void>;
}

const ERROR_TYPES: Array<{ value: ErrorType; label: string }> = [
  { value: "tone_mismatch", label: "Tone Mismatch" },
  { value: "missing_information", label: "Missing Information" },
  { value: "incorrect_response", label: "Incorrect Response" },
  { value: "technical_error", label: "Technical Error" },
  { value: "timeout", label: "Timeout" },
  { value: "user_confusion", label: "User Confusion" },
  { value: "hallucination", label: "Hallucination" },
  { value: "ext_transfer", label: "External Transfer" },
  { value: "csr_transfer", label: "CSR Transfer" },
  { value: "expected", label: "Expected" },
  { value: "unexpected", label: "Unexpected" },
  { value: "unknown", label: "Unknown" },
  { value: "other", label: "Other" },
];

export function CallDetailModal({ call, onClose, onSaveAnnotation }: CallDetailModalProps) {
  const [annotation, setAnnotation] = useState<Partial<Annotation>>({
    errorType: undefined,
    errorTypeCustom: "",
    observations: "",
    failureMode: "",
    suggestedFix: "",
    reviewed: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["transcript"]));
  const [fullCall, setFullCall] = useState<Call | null>(call);

  useEffect(() => {
    if (call) {
      // Fetch full call details including history
      fetch(`/api/calls?callId=${call.callId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.callId) {
            setFullCall(data);
            if (data.annotation) {
              setAnnotation(data.annotation);
            }
          }
        })
        .catch((error) => {
          console.error("Failed to fetch call details:", error);
          setFullCall(call);
        });
    }
  }, [call]);

  useEffect(() => {
    if (fullCall?.annotation) {
      setAnnotation(fullCall.annotation);
    } else {
      setAnnotation({
        errorType: undefined,
        errorTypeCustom: "",
        observations: "",
        failureMode: "",
        suggestedFix: "",
        reviewed: false,
      });
    }
  }, [fullCall]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleCategorize = async () => {
    if (!displayCall || !annotation.observations) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observations: [annotation.observations],
        }),
      });
      
      const data = await response.json();
      if (data.failureModes && data.failureModes.length > 0) {
        setAnnotation((prev) => ({
          ...prev,
          failureMode: data.failureModes[0].mode,
        }));
      }
    } catch (error) {
      console.error("Failed to categorize:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestFix = async () => {
    if (!displayCall || !annotation.failureMode || !annotation.observations) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/suggest-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failureMode: annotation.failureMode,
          observations: annotation.observations,
          transcript: displayCall.transcript,
        }),
      });
      
      const data = await response.json();
      if (data.suggestedFix) {
        setAnnotation((prev) => ({
          ...prev,
          suggestedFix: data.suggestedFix,
        }));
      }
    } catch (error) {
      console.error("Failed to suggest fix:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!displayCall || !annotation.observations) return;
    
    setIsLoading(true);
    try {
      await onSaveAnnotation(displayCall.callId, annotation as Annotation);
      onClose();
    } catch (error) {
      console.error("Failed to save annotation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayCall = fullCall || call;
  if (!displayCall) return null;

  const formatHistory = (history: any[]) => {
    if (!history || !Array.isArray(history)) return [];
    return history.map((item) => {
      const getText = (content: any): string => {
        if (!Array.isArray(content)) return "";
        return content
          .map((part: any) => {
            if (part?.type === "input_text" || part?.type === "output_text") return part.text || "";
            if (part?.type === "input_audio" || part?.type === "output_audio") return part.transcript || "";
            return part?.text || "";
          })
          .filter(Boolean)
          .join(" ");
      };
      return { ...item, text: getText(item.content) };
    });
  };

  const formattedHistory = displayCall.history ? formatHistory(displayCall.history) : [];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Call Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{displayCall.callId}</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="text-gray-500 dark:text-gray-400">
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Call Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Bot</label>
              <p className="text-gray-900 dark:text-white">{displayCall.bot}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</label>
              <p className="text-gray-900 dark:text-white">
                {Math.floor(displayCall.duration / 60)}:{(displayCall.duration % 60).toString().padStart(2, "0")}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className="text-gray-900 dark:text-white">{displayCall.status}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Confidence</label>
              <p className="text-gray-900 dark:text-white">{displayCall.confidence}%</p>
            </div>
          </div>

          {/* Transcript Section */}
          <div>
            <button
              onClick={() => toggleSection("transcript")}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">Transcript</h3>
              <span>{expandedSections.has("transcript") ? "−" : "+"}</span>
            </button>
            {expandedSections.has("transcript") && (
              <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {formattedHistory.length > 0 ? (
                  <div className="space-y-3">
                    {formattedHistory.map((item, idx) => (
                      <div key={idx} className="pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                        <div className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {item.role === "user" ? "User" : "Assistant"}
                        </div>
                        <div className="text-gray-900 dark:text-white">{item.text || "(no text)"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    {displayCall.transcript || "No transcript available"}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* History Details (Collapsed by default) */}
          {displayCall.history && displayCall.history.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection("history")}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">Full Call History</h3>
                <span>{expandedSections.has("history") ? "−" : "+"}</span>
              </button>
              {expandedSections.has("history") && (
                <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-96 overflow-y-auto">
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(displayCall.history, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Annotation Section */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Annotation</h3>
            
            {/* Error Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Error Type
              </label>
              <div className="flex flex-wrap gap-2">
                {ERROR_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setAnnotation((prev) => ({ ...prev, errorType: type.value }))}
                    className={`px-3 py-1 rounded-md text-sm border ${
                      annotation.errorType === type.value
                        ? "bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {annotation.errorType === "other" && (
                <input
                  type="text"
                  value={annotation.errorTypeCustom || ""}
                  onChange={(e) => setAnnotation((prev) => ({ ...prev, errorTypeCustom: e.target.value }))}
                  placeholder="Specify error type"
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              )}
            </div>

            {/* Observations */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observations *
              </label>
              <textarea
                value={annotation.observations || ""}
                onChange={(e) => setAnnotation((prev) => ({ ...prev, observations: e.target.value }))}
                placeholder="Record your observations about this call..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* AI Categorization */}
            <div className="mb-4 flex gap-2">
              <Button
                onClick={handleCategorize}
                disabled={isLoading || !annotation.observations}
                variant="outline"
                size="sm"
              >
                {isLoading ? "Categorizing..." : "🤖 AI: Categorize Failure Mode"}
              </Button>
            </div>

            {/* Failure Mode */}
            {annotation.failureMode && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Failure Mode (AI Categorized)
                </label>
                <input
                  type="text"
                  value={annotation.failureMode}
                  onChange={(e) => setAnnotation((prev) => ({ ...prev, failureMode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="reviewed"
                    checked={annotation.reviewed || false}
                    onChange={(e) => setAnnotation((prev) => ({ ...prev, reviewed: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="reviewed" className="text-sm text-gray-600 dark:text-gray-400">
                    Human Reviewed
                  </label>
                </div>
              </div>
            )}

            {/* AI Fix Suggestion */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Suggested Fix
                </label>
                <Button
                  onClick={handleSuggestFix}
                  disabled={isLoading || !annotation.failureMode}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? "Generating..." : "🤖 AI: Suggest Fix"}
                </Button>
              </div>
              {annotation.suggestedFix && (
                <textarea
                  value={annotation.suggestedFix}
                  onChange={(e) => setAnnotation((prev) => ({ ...prev, suggestedFix: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !annotation.observations}
          >
            {isLoading ? "Saving..." : "Save Annotation"}
          </Button>
        </div>
      </div>
    </div>
  );
}


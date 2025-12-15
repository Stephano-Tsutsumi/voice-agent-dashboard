"use client";

import React from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  RealtimeAgent,
  RealtimeItem,
  RealtimeSession,
  tool,
} from "@openai/agents/realtime";
import { getSessionToken } from "./actions/tokens";
import {
  generateCallId,
  calculateConfidence,
  calculateSentiment,
  calculateSeverity,
  detectIssues,
  type CallStatus,
  type Call,
} from "@/lib/calls";
import { Button } from "@/components/ui/button";
import z from "zod";

const getWeather = tool({
  name: "getWeather",
  description: "Get the weather in a given location",
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return `The weather in ${location} is sunny`;
  },
});

const searchKnowledgeBase = tool({
  name: "searchKnowledgeBase",
  description: "Search the knowledge base for relevant information. Use this when you need to reference documentation, guidelines, or ground truth information to answer questions accurately.",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant information"),
  }),
  execute: async ({ query }) => {
    try {
      const response = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 3 }),
      });

      if (!response.ok) {
        throw new Error("Failed to search knowledge base");
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return "No relevant information found in the knowledge base.";
      }

      // Format results for the agent
      const formattedResults = data.results
        .map((result: any, index: number) => {
          const source = result.metadata?.title || result.metadata?.source || "Unknown source";
          return `[${index + 1}] ${result.content}\n   Source: ${source}`;
        })
        .join("\n\n");

      return `Found ${data.results.length} relevant result(s):\n\n${formattedResults}`;
    } catch (error) {
      console.error("Error searching knowledge base:", error);
      return `Error searching knowledge base: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

const weatherAgent = new RealtimeAgent({
  name: "Weather Agent",
  instructions: "Talk with a New York accent",
  handoffDescription: "This agent is an expert in weather",
  tools: [getWeather],
});

const agent = new RealtimeAgent({
  name: "Voice Agent",
  instructions:
    "You are a voice agent that can answer questions and help with tasks. When you need accurate information or need to reference documentation, use the searchKnowledgeBase tool to find relevant information from the knowledge base before answering.",
  handoffs: [weatherAgent],
  tools: [getWeather, searchKnowledgeBase],
});

export default function Home() {
  const session = useRef<RealtimeSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<RealtimeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const callStartTime = useRef<Date | null>(null);
  const callId = useRef<string | null>(null);

  // Ensure microphone and any local media tracks are fully stopped
  async function stopLocalMedia() {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        return;
      }

      // Fallback: request a short-lived stream just to ensure all tracks are released.
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tmpStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      // Swallow errors – this is best-effort cleanup and should not block UI
      console.warn("Failed to fully stop local media tracks:", e);
    }
  }

  async function onConnect() {
    if (connected) {
      // End call and save
      const endTime = new Date();
      const duration = callStartTime.current
        ? Math.floor((endTime.getTime() - callStartTime.current.getTime()) / 1000)
        : 0;
      
      const confidence = calculateConfidence(history);
      const sentiment = calculateSentiment(history);
      const status: CallStatus = error ? "Failed" : "Completed";
      const issues = detectIssues(history, status);
      const severity = calculateSeverity(confidence, status, issues);
      
      // Generate callId if not set
      if (!callId.current) {
        callId.current = await generateCallId();
      }
      
      if (callId.current && callStartTime.current) {
        const call: Call = {
          id: callId.current,
          callId: callId.current,
          severity,
          bot: "Voice Agent v1.0",
          date: callStartTime.current || new Date(),
          duration,
          status,
          confidence,
          sentiment,
          issues,
          transcript: history
            .filter((item) => item.type === "message")
            .map((item) => {
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
              return `${item.role}: ${getText(item.content)}`;
            })
            .join("\n"),
          history: history, // Save full history for detailed analysis
        };
        
        // Save to database via API
        try {
          const response = await fetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to save call:", errorData);
          } else {
            console.log("Call saved successfully:", call.callId);
          }
        } catch (error) {
          console.error("Failed to save call:", error);
        }
      }
      
      setConnected(false);
      await session.current?.close();
      session.current = null;
      callStartTime.current = null;
      callId.current = null;
      setHistory([]);

      // Make sure microphone is fully released
      await stopLocalMedia();
    } else {
      try {
        setError(null);
        
        // Check for WebRTC support
        if (typeof window === "undefined") {
          throw new Error("This must run in a browser");
        }
        
        if (!window.RTCPeerConnection) {
          throw new Error("WebRTC is not supported in this browser");
        }
        
        // Check browser compatibility
        const userAgent = navigator.userAgent.toLowerCase();
        const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
        if (isSafari) {
          console.warn("Safari may have WebRTC compatibility issues. Consider using Chrome or Edge.");
        }
        
        const token = await getSessionToken();
        if (!token) {
          throw new Error("Failed to get session token");
        }
        
        console.log("Token received, length:", token.length);
        console.log("Token starts with:", token.substring(0, 20) + "...");
        
        session.current = new RealtimeSession(agent, {
          model: "gpt-4o-realtime-preview",
        });
        
        // Set up event handlers BEFORE connecting
        session.current.on("transport_event", (event) => {
          console.log("Transport event:", event);
          if (event.type === "error") {
            console.error("Transport error:", event);
            setError(`Transport error: ${JSON.stringify(event)}`);
            setConnected(false);
          }
        });
        
        session.current.on("history_updated", (history) => {
          setHistory(history);
        });
        
        session.current.on(
          "tool_approval_requested",
          async (context, agent, approvalRequest) => {
            const response = prompt("Approve or deny the tool call?");
            session.current?.approve(approvalRequest.approvalItem);
          }
        );
        
        session.current.on("error", (error) => {
          console.error("Session error:", error);
          setError(`Session error: ${error instanceof Error ? error.message : String(error)}`);
          setConnected(false);
        });
        
        console.log("Connecting with token...");
        try {
          // Establish connection – RealtimeSession will manage WebRTC + audio
          await session.current.connect({
            apiKey: token,
          });
          console.log("Connected successfully");
          
          // Start tracking call
          callStartTime.current = new Date();
          callId.current = await generateCallId();
          
          setConnected(true);
        } catch (connectError) {
          console.error("Connect error details:", connectError);
          throw connectError;
        }
      } catch (error) {
        console.error("Failed to connect:", error);
        let errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide helpful message for SDP parsing errors
        if (errorMessage.includes("SDP") || errorMessage.includes("parse")) {
          const browser = navigator.userAgent.includes("Firefox") ? "Firefox" :
                         navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" :
                         "your browser";
          errorMessage = `WebRTC connection failed (SDP parsing error). This is often a browser compatibility issue. Try using Chrome or Edge instead of ${browser}. Error: ${errorMessage}`;
        }
        
        setError(errorMessage);
        setConnected(false);
        if (session.current) {
          try {
            await session.current.close();
          } catch (e) {
            // Ignore close errors
          }
          session.current = null;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Voice Agent Demo</h1>
            <p className="text-muted-foreground">Connect and interact with the voice agent</p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">View Dashboard</Button>
          </Link>
        </div>
        
        {callId.current && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-lg text-sm">
            <strong>Call ID:</strong> {callId.current} | <strong>Duration:</strong>{" "}
            {callStartTime.current
              ? Math.floor((new Date().getTime() - callStartTime.current.getTime()) / 1000)
              : 0}{" "}
            seconds
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <div className="mb-6">
          <Button
            onClick={onConnect}
            variant={connected ? "destructive" : "default"}
            size="lg"
          >
            {connected ? "Disconnect" : "Connect"}
          </Button>
        </div>
        
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="text-lg font-semibold mb-4 text-card-foreground">Conversation History</h2>
          <ul className="space-y-3">
        {history
          .filter((item) => item.type === "message")
          .map((item) => {
            // Extract text from content array
            const getTextFromContent = (content: any): string => {
              // Handle if content is a string
              if (typeof content === "string") {
                try {
                  const parsed = JSON.parse(content);
                  if (Array.isArray(parsed)) {
                    content = parsed;
                  } else {
                    return content;
                  }
                } catch {
                  return content;
                }
              }
              
              // Handle if content is not an array
              if (!Array.isArray(content)) {
                return "";
              }
              
              // Extract text from content parts - collect all text parts
              const textParts: string[] = [];
              
              for (const part of content) {
                // Handle text content types
                if (part?.type === "input_text" || part?.type === "output_text") {
                  if (part.text) {
                    textParts.push(part.text);
                  }
                }
                // Handle audio with transcript
                else if (part?.type === "input_audio" && part.transcript) {
                  textParts.push(part.transcript);
                }
                // Handle output_audio (assistant voice responses might have this)
                else if (part?.type === "output_audio" && part.transcript) {
                  textParts.push(part.transcript);
                }
                // Fallback: check for text property directly
                else if (part?.text && typeof part.text === "string") {
                  textParts.push(part.text);
                }
              }
              
              // Return combined text or empty string
              return textParts.join(" ").trim();
            };

            const text = getTextFromContent(item.content);
            const roleLabel = item.role === "user" ? "user" : "Assistant";
            
            // Debug: log assistant messages to see structure
            if (item.role === "assistant" && !text) {
              console.log("Assistant message with no text:", item);
              console.log("Content:", item.content);
            }
            
            // Only render if we have text
            if (!text) {
              return null;
            }
            
            return (
              <li key={item.itemId} className="py-2 px-3 rounded-md bg-muted/50">
                <span className="font-semibold text-foreground">{roleLabel}:</span>{" "}
                <span className="text-foreground">{text}</span>
              </li>
            );
          })
          .filter(Boolean)}
          </ul>
        </div>
      </div>
    </div>
  );
}


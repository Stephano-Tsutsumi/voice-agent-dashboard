"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RAGUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setUploading(true);
    setError(null);
    setStatus(null);

    try {
      const documents = await Promise.all(
        files.map(async (file, index) => {
          const content = await readFileAsText(file);
          return {
            content,
            documentId: `${file.name}_${Date.now()}_${index}`,
            source: file.name,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          };
        })
      );

      const response = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload documents");
      }

      const data = await response.json();
      setStatus(`Successfully ingested ${documents.length} document(s)!`);
      setFiles([]);
    } catch (error) {
      console.error("Upload error:", error);
      setError(error instanceof Error ? error.message : "Failed to upload documents");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upload Documents to Knowledge Base</CardTitle>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Dashboard</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Documents (TXT, MD, or other text files)
            </label>
            <input
              type="file"
              multiple
              accept=".txt,.md,.text,.json"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            />
            {files.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {files.length} file(s) selected
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {status && (
            <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-200 rounded">
              <strong>Success:</strong> {status}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="w-full"
          >
            {uploading ? "Uploading and Processing..." : "Upload Documents"}
          </Button>

          <div className="mt-6 p-4 bg-muted/20 rounded-lg">
            <h3 className="font-semibold mb-2">How it works:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>1. Upload text documents (TXT, MD, JSON, etc.)</li>
              <li>2. Documents are automatically chunked and embedded</li>
              <li>3. Stored in Qdrant vector database</li>
              <li>4. Voice agent can search and reference these documents</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


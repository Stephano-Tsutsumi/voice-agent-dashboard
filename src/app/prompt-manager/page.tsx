"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { type Prompt } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PromptManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    category: "",
    tags: "",
    isActive: false,
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(data);
      }
    } catch (error) {
      console.error("Failed to fetch prompts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedPrompt(null);
    setIsEditing(false);
    setFormData({
      name: "",
      description: "",
      content: "",
      category: "",
      tags: "",
      isActive: false,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsEditing(true);
    setFormData({
      name: prompt.name,
      description: prompt.description || "",
      content: prompt.content,
      category: prompt.category || "",
      tags: prompt.tags || "",
      isActive: prompt.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const prompt: Prompt = {
        id: selectedPrompt?.id || `prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: formData.name,
        description: formData.description || undefined,
        content: formData.content,
        category: formData.category || undefined,
        tags: formData.tags || undefined,
        version: selectedPrompt ? selectedPrompt.version + 1 : 1,
        isActive: formData.isActive,
        createdAt: selectedPrompt?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
      });

      if (response.ok) {
        await fetchPrompts();
        setIsDialogOpen(false);
        setSelectedPrompt(null);
      }
    } catch (error) {
      console.error("Failed to save prompt:", error);
      alert("Failed to save prompt. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      const response = await fetch(`/api/prompts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPrompts();
      }
    } catch (error) {
      console.error("Failed to delete prompt:", error);
      alert("Failed to delete prompt. Please try again.");
    }
  };

  const groupedPrompts = prompts.reduce((acc, prompt) => {
    const category = prompt.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(prompt);
    return acc;
  }, {} as Record<string, Prompt[]>);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white p-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Prompt Manager</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage and organize your voice agent prompts</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/analysis">
              <Button variant="outline" className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                Back to Analysis
              </Button>
            </Link>
            <Button
              onClick={handleCreateNew}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              + New Prompt
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading prompts...</div>
        ) : prompts.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No prompts yet.</p>
            <Button
              onClick={handleCreateNew}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Your First Prompt
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
              <div key={category} className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  {category} ({categoryPrompts.length})
                </h2>
                <div className="space-y-4">
                  {categoryPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{prompt.name}</h3>
                            {prompt.isActive && (
                              <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                Active
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              v{prompt.version}
                            </Badge>
                          </div>
                          {prompt.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{prompt.description}</p>
                          )}
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-sans text-xs">{prompt.content.substring(0, 300)}{prompt.content.length > 300 ? "..." : ""}</pre>
                          </div>
                          {prompt.tags && (
                            <div className="flex gap-1 flex-wrap">
                              {prompt.tags.split(",").map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {tag.trim()}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Updated: {prompt.updatedAt.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => handleEdit(prompt)}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(prompt.id)}
                          variant="outline"
                          size="sm"
                          className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                {isEditing ? "Edit Prompt" : "Create New Prompt"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., Main Voice Agent Prompt"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Brief description of this prompt"
                />
              </div>
              <div>
                <Label htmlFor="content" className="text-gray-700 dark:text-gray-300">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                  rows={12}
                  placeholder="Enter your prompt content here..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category" className="text-gray-700 dark:text-gray-300">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="e.g., Main Agent, Handoff, Error Handling"
                  />
                </div>
                <div>
                  <Label htmlFor="tags" className="text-gray-700 dark:text-gray-300">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="e.g., main, voice, customer-service"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive" className="text-gray-700 dark:text-gray-300">Set as active prompt</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!formData.name.trim() || !formData.content.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isEditing ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { type Ticket } from "@/lib/test-cases";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TicketManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as Ticket["priority"],
    status: "open" as Ticket["status"],
    assignedTo: "",
    failureMode: "",
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tickets?all=true");
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedTicket(null);
    setIsEditing(false);
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      status: "open",
      assignedTo: "",
      failureMode: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsEditing(true);
    setFormData({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: ticket.assignedTo || "",
      failureMode: ticket.failureMode,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const ticket: Ticket = {
        id: selectedTicket?.id || `ticket_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        testCaseId: selectedTicket?.testCaseId,
        failureMode: formData.failureMode || "general",
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        assignedTo: formData.assignedTo || undefined,
        createdAt: selectedTicket?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticket),
      });

      if (response.ok) {
        await fetchTickets();
        setIsDialogOpen(false);
        setSelectedTicket(null);
      }
    } catch (error) {
      console.error("Failed to save ticket:", error);
      alert("Failed to save ticket. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;

    try {
      const response = await fetch(`/api/tickets?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTickets();
      }
    } catch (error) {
      console.error("Failed to delete ticket:", error);
      alert("Failed to delete ticket. Please try again.");
    }
  };

  const getPriorityColor = (priority: Ticket["priority"]) => {
    const colors = {
      low: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      medium: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
      high: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
      critical: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    };
    return colors[priority];
  };

  const getStatusColor = (status: Ticket["status"]) => {
    const colors = {
      open: "bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
      in_progress: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
      resolved: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
      closed: "bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
    };
    return colors[status];
  };

  const groupedTickets = tickets.reduce((acc, ticket) => {
    const category = ticket.failureMode || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(ticket);
    return acc;
  }, {} as Record<string, Ticket[]>);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white p-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Ticket Manager</h1>
            <p className="text-gray-600 dark:text-gray-400">View and manage all bug tickets</p>
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
              + New Ticket
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No tickets yet.</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Tickets will appear here when created from test cases or the chat UI.
            </p>
            <Button
              onClick={handleCreateNew}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Your First Ticket
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTickets).map(([failureMode, categoryTickets]) => (
              <div key={failureMode} className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-[#0a0a0a]">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white capitalize">
                  {failureMode.replace(/_/g, " ")} ({categoryTickets.length})
                </h2>
                <div className="space-y-4">
                  {categoryTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{ticket.title}</h3>
                            <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                              {ticket.priority}
                            </Badge>
                            <Badge variant="outline" className={getStatusColor(ticket.status)}>
                              {ticket.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 whitespace-pre-wrap">
                            {ticket.description}
                          </div>
                          {ticket.assignedTo && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              Assigned to: {ticket.assignedTo}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Created: {ticket.createdAt.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => handleEdit(ticket)}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(ticket.id)}
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
                {isEditing ? "Edit Ticket" : "Create New Ticket"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., Voice agent fails to handle ambiguous user intent"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  rows={8}
                  placeholder="Describe the issue, steps to reproduce, expected vs actual behavior..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority" className="text-gray-700 dark:text-gray-300">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value as Ticket["priority"] })}
                  >
                    <SelectTrigger className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status" className="text-gray-700 dark:text-gray-300">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as Ticket["status"] })}
                  >
                    <SelectTrigger className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="failureMode" className="text-gray-700 dark:text-gray-300">Failure Mode</Label>
                  <Input
                    id="failureMode"
                    value={formData.failureMode}
                    onChange={(e) => setFormData({ ...formData, failureMode: e.target.value })}
                    className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="e.g., tone_mismatch, unknown"
                  />
                </div>
                <div>
                  <Label htmlFor="assignedTo" className="text-gray-700 dark:text-gray-300">Assigned To</Label>
                  <Input
                    id="assignedTo"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="e.g., developer@example.com"
                  />
                </div>
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
                  disabled={!formData.title.trim() || !formData.description.trim()}
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


import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertCircle, FileText, LogOut, BarChart, TrendingUp, MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { LineChart, Line, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
  const { user, logout, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("analytics");

  // Check if user is admin
  if (isAuthenticated && user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You do not have permission to access the admin dashboard.</p>
          <Button onClick={logout} variant="outline">
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name}</span>
          <Button onClick={() => navigate("/")} variant="outline" size="sm">
            <MessageSquare className="w-4 h-4 mr-2" />
            Test Chat
          </Button>
          <Button onClick={logout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="escalations">Escalations</TabsTrigger>
            <TabsTrigger value="documentation">Documentation</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsTab />
          </TabsContent>

          {/* Escalations Tab */}
          <TabsContent value="escalations" className="space-y-6">
            <EscalationsTab />
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="documentation" className="space-y-6">
            <DocumentationTab />
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-6">
            <KnowledgeBaseTab />
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-6">
            <AuditLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Helper functions for status and priority colors
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-orange-100 text-orange-800";
    case "low":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Analytics Tab Component
 */
function AnalyticsTab() {
  const analyticsQuery = trpc.admin.getAnalytics.useQuery({});

  if (analyticsQuery.isLoading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  const data = analyticsQuery.data || {
    totalConversations: 0,
    totalMessages: 0,
    activeEscalations: 0,
    resolvedEscalations: 0,
    aiGeneratedMessages: 0,
    detectedPatterns: 0,
    averageMessagesPerConversation: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Conversations" value={data.totalConversations} icon={<MessageSquare className="w-6 h-6 text-blue-600" />} />
        <StatCard title="Total Messages" value={data.totalMessages} icon={<BarChart className="w-6 h-6 text-green-600" />} />
        <StatCard title="Active Escalations" value={data.activeEscalations} icon={<AlertCircle className="w-6 h-6 text-red-600" />} />
        <StatCard title="Resolved Escalations" value={data.resolvedEscalations} icon={<TrendingUp className="w-6 h-6 text-cyan-600" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="AI Generated Messages" value={data.aiGeneratedMessages} icon={<BarChart className="w-6 h-6 text-purple-600" />} />
        <StatCard title="Detected Patterns" value={data.detectedPatterns} icon={<BarChart className="w-6 h-6 text-indigo-600" />} />
        <StatCard
          title="Avg Messages/Conversation"
          value={data.averageMessagesPerConversation.toFixed(2)}
          icon={<BarChart className="w-6 h-6 text-cyan-600" />}
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Conversation Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={[{ name: "Conversations", value: data.totalConversations }]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="opacity-50">{icon}</div>
      </div>
    </Card>
  );
}

/**
 * Escalations Tab Component
 */
function EscalationsTab() {
  const escalationsQuery = trpc.admin.getEscalations.useQuery({ limit: 20 });
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);

  if (escalationsQuery.isLoading) {
    return <div className="text-center py-8">Loading escalations...</div>;
  }

  const escalations = escalationsQuery.data || [];
  const filtered = selectedStatus ? escalations.filter((t) => t.status === selectedStatus) : escalations;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Escalation Tickets</h2>
        <div className="flex gap-2">
          <Button variant={selectedStatus === undefined ? "default" : "outline"} onClick={() => setSelectedStatus(undefined)} size="sm">
            All
          </Button>
          <Button variant={selectedStatus === "pending" ? "default" : "outline"} onClick={() => setSelectedStatus("pending")} size="sm">
            Pending
          </Button>
          <Button variant={selectedStatus === "in_progress" ? "default" : "outline"} onClick={() => setSelectedStatus("in_progress")} size="sm">
            In Progress
          </Button>
          <Button variant={selectedStatus === "resolved" ? "default" : "outline"} onClick={() => setSelectedStatus("resolved")} size="sm">
            Resolved
          </Button>
        </div>
      </div>

      {selectedTicket ? (
        <div>
          <Button onClick={() => setSelectedTicket(null)} variant="outline" size="sm" className="mb-4">
            ← Back to List
          </Button>
          <EscalationDetailView ticketId={selectedTicket} />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No escalations found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <Card key={ticket.id} className="p-4 hover:bg-gray-50 transition cursor-pointer" onClick={() => setSelectedTicket(ticket.id)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Ticket #{ticket.id}</span>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  </div>
                  <p className="text-sm text-gray-600">{ticket.reason}</p>
                  <p className="text-xs text-gray-500 mt-1">Created: {new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-gray-400 ml-4">→</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Escalation Detail View Component
 */
function EscalationDetailView({ ticketId }: { ticketId: number }) {
  const escalationsQuery = trpc.admin.getEscalations.useQuery({ limit: 100 });
  const ticket = escalationsQuery.data?.find((t) => t.id === ticketId);

  if (escalationsQuery.isLoading) {
    return <div className="text-center py-8">Loading ticket details...</div>;
  }

  if (!ticket) {
    return (
      <Card className="p-8 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Ticket not found</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Ticket #{ticket.id}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-600">Status</p>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-600">Priority</p>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">Reason</p>
        <p className="text-gray-900">{ticket.reason}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">Assigned To</p>
        <p className="text-gray-900">{ticket.assignedTo || "Unassigned"}</p>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">Created: {new Date(ticket.createdAt).toLocaleString()}</p>
      </div>
    </Card>
  );
}

/**
 * Documentation Tab Component
 */
function DocumentationTab() {
  const [newDoc, setNewDoc] = useState({ title: "", content: "", departmentId: 1 });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Add Documentation</h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Title"
            value={newDoc.title}
            onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Content"
            value={newDoc.content}
            onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
          />
          <Button className="w-full">Add Documentation</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Documentation List</h3>
        <p className="text-gray-600">No documentation items yet</p>
      </Card>
    </div>
  );
}

/**
 * Knowledge Base Tab Component
 */
function KnowledgeBaseTab() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Knowledge Base</h3>
        <p className="text-gray-600">Knowledge base management coming soon</p>
      </Card>
    </div>
  );
}

/**
 * Audit Logs Tab Component
 */
function AuditLogsTab() {
  const auditLogsQuery = trpc.admin.getAuditLogs.useQuery({ limit: 50 });

  if (auditLogsQuery.isLoading) {
    return <div className="text-center py-8">Loading audit logs...</div>;
  }

  const logs = auditLogsQuery.data || [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
      {logs.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No audit logs found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log, idx) => (
            <Card key={idx} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{log.action}</p>
                  <p className="text-sm text-gray-600">{log.resourceType}: {log.resourceId}</p>
                  <p className="text-xs text-gray-500 mt-1">By: {log.userId} - {new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

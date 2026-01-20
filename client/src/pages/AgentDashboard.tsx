import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { LogOut, MessageSquare, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function AgentDashboard() {
  const { user, logout } = useAuth();
  const [selectedEscalation, setSelectedEscalation] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "in_progress" | "resolved" | undefined>();

  const { data: escalations, isLoading: escalationsLoading } = trpc.agentDashboard.getMyEscalations.useQuery({
    status: statusFilter,
  });

  const { data: escalationDetails } = trpc.agentDashboard.getEscalationDetails.useQuery(
    { escalationId: selectedEscalation! },
    { enabled: !!selectedEscalation }
  );

  const { data: stats } = trpc.agentDashboard.getAgentStats.useQuery();

  const updateStatusMutation = trpc.agentDashboard.updateEscalationStatus.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh data
      trpc.useUtils().agentDashboard.getMyEscalations.invalidate();
      trpc.useUtils().agentDashboard.getAgentStats.invalidate();
    },
  });

  const acceptMutation = trpc.agentDashboard.acceptEscalation.useMutation({
    onSuccess: () => {
      trpc.useUtils().agentDashboard.getMyEscalations.invalidate();
      trpc.useUtils().agentDashboard.getAgentStats.invalidate();
    },
  });

  const transferMutation = trpc.agentDashboard.transferEscalation.useMutation({
    onSuccess: () => {
      trpc.useUtils().agentDashboard.getMyEscalations.invalidate();
      trpc.useUtils().agentDashboard.getAgentStats.invalidate();
      setSelectedEscalation(null);
    },
  });

  const getStatusColor = (status: string) => {
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
  };

  const getPriorityColor = (priority: string) => {
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
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Agent Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          </div>
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Escalations</p>
                <p className="text-2xl font-bold">{stats?.totalEscalations || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{stats?.inProgress || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-2xl font-bold">{stats?.resolved || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Escalations List */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-semibold mb-4">My Escalations</h2>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={statusFilter === undefined ? "default" : "outline"}
                    onClick={() => setStatusFilter(undefined)}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "pending" ? "default" : "outline"}
                    onClick={() => setStatusFilter("pending")}
                  >
                    Pending
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "in_progress" ? "default" : "outline"}
                    onClick={() => setStatusFilter("in_progress")}
                  >
                    In Progress
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {escalationsLoading ? (
                    <p className="text-sm text-gray-500">Loading escalations...</p>
                  ) : escalations && escalations.length > 0 ? (
                    escalations.map((escalation: any) => (
                      <div
                        key={escalation.id}
                        onClick={() => setSelectedEscalation(escalation.id)}
                        className={`w-full p-3 rounded-lg text-left border transition-colors ${
                          selectedEscalation === escalation.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-sm font-medium truncate">
                            Escalation #{escalation.id}
                          </span>
                          <Badge className={getPriorityColor(escalation.priority)}>
                            {escalation.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {escalation.reason}
                        </p>
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getStatusColor(escalation.status)}>
                            {escalation.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(escalation.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => alert("Status updated")}>
                            {escalation.status === "pending" ? "Accept" : "Resolve"}
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => alert("Transfer dialog")}>
                            Transfer
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No escalations assigned</p>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Escalation Details */}
          <div className="lg:col-span-2">
            {selectedEscalation && escalationDetails ? (
              <Card className="h-full flex flex-col">
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-lg">
                        Escalation #{escalationDetails.escalation.id}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {escalationDetails.escalation.reason}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getPriorityColor(escalationDetails.escalation.priority)}>
                        {escalationDetails.escalation.priority}
                      </Badge>
                      <Badge className={getStatusColor(escalationDetails.escalation.status)}>
                        {escalationDetails.escalation.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {escalationDetails.escalation.status !== "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            escalationId: escalationDetails.escalation.id,
                            status: "in_progress",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        Start Working
                      </Button>
                    )}
                    {escalationDetails.escalation.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            escalationId: escalationDetails.escalation.id,
                            status: "resolved",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {escalationDetails.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          (message as any).senderType === "user" ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            (message as any).senderType === "user"
                              ? "bg-gray-100 text-gray-900"
                              : "bg-blue-500 text-white"
                          }`}
                        >
                          <p className="text-sm">{(message as any).content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              (message as any).senderType === "user"
                                ? "text-gray-600"
                                : "text-blue-100"
                            }`}
                          >
                            {formatDistanceToNow(new Date((message as any).createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select an escalation to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

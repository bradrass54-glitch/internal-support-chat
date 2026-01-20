import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Upload, Plus, Trash2, Edit2, Shield } from "lucide-react";

export default function WorkspaceSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("branding");

  // Queries
  const workspaceQuery = trpc.workspaceSettings.getWorkspaceSettings.useQuery();
  const departmentsQuery = trpc.workspaceSettings.getDepartments.useQuery();
  const escalationRulesQuery = trpc.workspaceSettings.getEscalationRules.useQuery({});

  // Mutations
  const updateBrandingMutation = trpc.workspaceSettings.updateBranding.useMutation({
    onSuccess: () => {
      toast.success("Branding updated successfully");
      workspaceQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const createDepartmentMutation = trpc.workspaceSettings.createDepartment.useMutation({
    onSuccess: () => {
      toast.success("Department created successfully");
      departmentsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteDepartmentMutation = trpc.workspaceSettings.deleteDepartment.useMutation({
    onSuccess: () => {
      toast.success("Department deleted successfully");
      departmentsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const createEscalationRuleMutation = trpc.workspaceSettings.createEscalationRule.useMutation({
    onSuccess: () => {
      toast.success("Escalation rule created successfully");
      escalationRulesQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteEscalationRuleMutation = trpc.workspaceSettings.deleteEscalationRule.useMutation({
    onSuccess: () => {
      toast.success("Escalation rule deleted successfully");
      escalationRulesQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // Form states
  const [brandingForm, setBrandingForm] = useState({
    name: workspaceQuery.data?.name || "",
    description: workspaceQuery.data?.description || "",
  });

  const [newDepartment, setNewDepartment] = useState({ name: "", description: "" });
  const [newRule, setNewRule] = useState({
    departmentId: 0,
    name: "",
    description: "",
    triggerType: "time_elapsed" as const,
    triggerValue: "",
    assignToDepartment: undefined as number | undefined,
    priority: "medium" as const,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Workspace Settings</h1>
          <p className="text-gray-600">Manage your workspace branding, departments, and escalation rules</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="escalation">Escalation Rules</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Branding</CardTitle>
                <CardDescription>Customize your workspace name, description, and logo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Workspace Name</label>
                  <Input
                    value={brandingForm.name}
                    onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })}
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={brandingForm.description}
                    onChange={(e) => setBrandingForm({ ...brandingForm, description: e.target.value })}
                    placeholder="Brief description of your workspace"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>

                <Button
                  onClick={() => {
                    updateBrandingMutation.mutate({
                      name: brandingForm.name,
                      description: brandingForm.description,
                    });
                  }}
                  disabled={updateBrandingMutation.isPending}
                >
                  {updateBrandingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create Department</CardTitle>
                  <CardDescription>Add a new support department</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department Name</label>
                    <Input
                      value={newDepartment.name}
                      onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                      placeholder="e.g., IT Support, HR, Finance"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={newDepartment.description}
                      onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                      placeholder="What does this department handle?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (!newDepartment.name) {
                        toast.error("Please enter a department name");
                        return;
                      }
                      createDepartmentMutation.mutate({
                        name: newDepartment.name,
                        description: newDepartment.description,
                      });
                      setNewDepartment({ name: "", description: "" });
                    }}
                    disabled={createDepartmentMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Department
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Departments</CardTitle>
                </CardHeader>
                <CardContent>
                  {departmentsQuery.isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : departmentsQuery.data?.length === 0 ? (
                    <p className="text-gray-500">No departments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {departmentsQuery.data?.map((dept) => (
                        <div key={dept.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <h3 className="font-medium text-gray-900">{dept.name}</h3>
                            <p className="text-sm text-gray-600">{dept.description}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteDepartmentMutation.mutate({ id: dept.id })}
                            disabled={deleteDepartmentMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Escalation Rules Tab */}
          <TabsContent value="escalation">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create Escalation Rule</CardTitle>
                  <CardDescription>Define automatic escalation triggers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      value={newRule.departmentId}
                      onChange={(e) => setNewRule({ ...newRule, departmentId: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Select a department</option>
                      {departmentsQuery.data?.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name</label>
                    <Input
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="e.g., Escalate after 5 minutes"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
                    <select
                      value={newRule.triggerType}
                      onChange={(e) => setNewRule({ ...newRule, triggerType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="time_elapsed">Time Elapsed</option>
                      <option value="keyword_match">Keyword Match</option>
                      <option value="satisfaction_score">Satisfaction Score</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Value</label>
                    <Input
                      value={newRule.triggerValue}
                      onChange={(e) => setNewRule({ ...newRule, triggerValue: e.target.value })}
                      placeholder="e.g., 5 minutes, refund, 0.3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={newRule.priority}
                      onChange={(e) => setNewRule({ ...newRule, priority: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <Button
                    onClick={() => {
                      if (!newRule.name || newRule.departmentId === 0) {
                        toast.error("Please fill in all required fields");
                        return;
                      }
                      createEscalationRuleMutation.mutate({
                        departmentId: newRule.departmentId,
                        name: newRule.name,
                        description: "",
                        triggerType: newRule.triggerType,
                        triggerValue: newRule.triggerValue,
                        priority: newRule.priority,
                      });
                      setNewRule({
                        departmentId: 0,
                        name: "",
                        description: "",
                        triggerType: "time_elapsed",
                        triggerValue: "",
                        assignToDepartment: undefined,
                        priority: "medium",
                      });
                    }}
                    disabled={createEscalationRuleMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Rule
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Escalation Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  {escalationRulesQuery.isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : escalationRulesQuery.data?.length === 0 ? (
                    <p className="text-gray-500">No escalation rules yet</p>
                  ) : (
                    <div className="space-y-3">
                      {escalationRulesQuery.data?.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <h3 className="font-medium text-gray-900">{rule.name}</h3>
                            <p className="text-sm text-gray-600">
                              {rule.triggerType}: {rule.triggerValue} • Priority: {rule.priority}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEscalationRuleMutation.mutate({ id: rule.id })}
                            disabled={deleteEscalationRuleMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Team Members Tab */}
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage workspace users and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamMembersTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Invite Team Members</CardTitle>
                <CardDescription>Send invitations to join your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <InvitationsTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TeamMembersTab() {
  const usersQuery = trpc.users.getWorkspaceUsers.useQuery();
  const updateRoleMutation = trpc.users.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated successfully");
      usersQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  if (usersQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {usersQuery.data?.length === 0 ? (
        <p className="text-gray-500">No users in this workspace yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Joined</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data?.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{u.name || "Unnamed"}</td>
                  <td className="py-3 px-4 text-gray-600">{u.email || "No email"}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          userId: u.id,
                          role: e.target.value as "user" | "admin",
                        })
                      }
                      disabled={updateRoleMutation.isPending}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Unknown"}
                  </td>
                  <td className="py-3 px-4">
                    {u.role === "admin" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function InvitationsTab() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "agent" | "user">("user");
  const invitationsQuery = trpc.workspaceManagement.getPendingInvitations.useQuery({ limit: 100 });
  const sendInvitationMutation = trpc.workspaceManagement.sendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setEmail("");
      setRole("user");
      invitationsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const resendMutation = trpc.workspaceManagement.resendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation resent");
      invitationsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancelMutation = trpc.workspaceManagement.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      invitationsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await sendInvitationMutation.mutateAsync({
      email: email.trim(),
      role,
    });
  };

  if (invitationsQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const invitations = invitationsQuery.data || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="user">User</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={sendInvitationMutation.isPending || !email.trim()}
            >
              {sendInvitationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending invitations</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{inv.email}</p>
                    <p className="text-sm text-gray-600">
                      Role: <span className="font-medium">{inv.role}</span> • Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => resendMutation.mutate({ invitationId: inv.id })}
                      variant="outline"
                      size="sm"
                      disabled={resendMutation.isPending}
                    >
                      Resend
                    </Button>
                    <Button
                      onClick={() => cancelMutation.mutate({ invitationId: inv.id })}
                      variant="destructive"
                      size="sm"
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

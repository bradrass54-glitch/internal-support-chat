import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Upload, Plus, Trash2, Edit2 } from "lucide-react";

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
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="escalation">Escalation Rules</TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Branding</CardTitle>
                <CardDescription>Customize your workspace name, description, and logo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {workspaceQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Workspace Name</label>
                      <Input
                        value={brandingForm.name}
                        onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })}
                        placeholder="Your workspace name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={brandingForm.description}
                        onChange={(e) => setBrandingForm({ ...brandingForm, description: e.target.value })}
                        placeholder="Optional description"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                      />
                    </div>

                    {workspaceQuery.data?.logo && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Logo</label>
                        <img src={workspaceQuery.data.logo} alt="Logo" className="h-20 w-20 object-cover rounded" />
                      </div>
                    )}

                    <Button
                      onClick={() =>
                        updateBrandingMutation.mutate({
                          name: brandingForm.name,
                          description: brandingForm.description,
                        })
                      }
                      disabled={updateBrandingMutation.isPending}
                      className="w-full"
                    >
                      {updateBrandingMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Branding"
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Department</CardTitle>
                  <CardDescription>Add a new support department to your workspace</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department Name</label>
                    <Input
                      value={newDepartment.name}
                      onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                      placeholder="e.g., IT Support"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={newDepartment.description}
                      onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                      placeholder="Department description"
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
                  <CardTitle>Existing Departments</CardTitle>
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
                            {dept.description && <p className="text-sm text-gray-600">{dept.description}</p>}
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
                  <CardDescription>Define when conversations should be escalated to live agents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name</label>
                    <Input
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="e.g., High Priority Issues"
                    />
                  </div>

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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
                    <select
                      value={newRule.triggerType}
                      onChange={(e) => setNewRule({ ...newRule, triggerType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="time_elapsed">Time Elapsed</option>
                      <option value="keyword_match">Keyword Match</option>
                      <option value="user_request">User Request</option>
                      <option value="ai_confidence">AI Confidence</option>
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
        </Tabs>
      </div>
    </div>
  );
}

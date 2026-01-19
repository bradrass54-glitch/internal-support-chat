import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface Department {
  name: string;
  description?: string;
}

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([
    { name: "IT Support", description: "Technical support and IT infrastructure" },
    { name: "Human Resources", description: "HR policies and employee services" },
    { name: "Finance", description: "Financial services and billing" },
  ]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templates = trpc.setup.getDepartmentTemplates.useQuery();
  const completeSetup = trpc.setup.completeSetup.useMutation();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogo(base64);
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const addDepartment = () => {
    if (!newDeptName.trim()) {
      toast.error("Department name is required");
      return;
    }

    setDepartments([
      ...departments,
      { name: newDeptName, description: newDeptDesc || undefined },
    ]);
    setNewDeptName("");
    setNewDeptDesc("");
  };

  const removeDepartment = (index: number) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    if (departments.length === 0) {
      toast.error("Please add at least one department");
      return;
    }

    try {
      await completeSetup.mutateAsync({
        name: workspaceName,
        description: workspaceDescription || undefined,
        logo: logo || undefined,
        departments,
      });

      toast.success("Workspace setup complete!");
      onComplete();
    } catch (error) {
      console.error("Setup failed:", error);
      toast.error("Failed to complete setup");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome to Your Workspace</h1>
            <p className="text-slate-600">
              Let's set up your support system. Step {step} of 3
            </p>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-blue-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Workspace Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Workspace Name *
                </label>
                <Input
                  placeholder="e.g., Acme Corporation"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  placeholder="Optional description of your workspace"
                  value={workspaceDescription}
                  onChange={(e) => setWorkspaceDescription(e.target.value)}
                  rows={4}
                  className="text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Workspace Logo
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  {logoPreview ? (
                    <div className="space-y-4">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-32 h-32 object-contain mx-auto"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLogo(null);
                          setLogoPreview(null);
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-600">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Departments */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Configure Departments
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  Add the departments that will handle support requests
                </p>
              </div>

              {/* Current Departments */}
              <div className="space-y-3">
                {departments.map((dept, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{dept.name}</p>
                      {dept.description && (
                        <p className="text-xs text-slate-600 mt-1">
                          {dept.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDepartment(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Department */}
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium text-sm">Add Department</h3>
                <Input
                  placeholder="Department name"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") addDepartment();
                  }}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  rows={2}
                />
                <Button onClick={addDepartment} className="w-full">
                  Add Department
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Review Setup</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Verify your workspace configuration
                </p>
              </div>

              <div className="space-y-4">
                {logoPreview && (
                  <div className="flex justify-center">
                    <img
                      src={logoPreview}
                      alt="Workspace logo"
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide">
                      Workspace Name
                    </p>
                    <p className="font-medium">{workspaceName}</p>
                  </div>

                  {workspaceDescription && (
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide">
                        Description
                      </p>
                      <p className="text-sm">{workspaceDescription}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
                      Departments ({departments.length})
                    </p>
                    <ul className="space-y-1">
                      {departments.map((dept, index) => (
                        <li key={index} className="text-sm">
                          • {dept.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={completeSetup.isPending}
              >
                Back
              </Button>
            )}

            <div className="flex-1" />

            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !workspaceName.trim()) ||
                  (step === 2 && departments.length === 0)
                }
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={completeSetup.isPending}
              >
                {completeSetup.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Upload, Trash2, Archive, FileText, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Document {
  id: number;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: Date;
  uploadedBy: number;
}

export default function KnowledgeBaseManagement() {
  const [departmentId, setDepartmentId] = useState<number>(1); // Default to IT
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TRPC hooks
  const getDocumentsQuery = trpc.knowledgeBase.getDocuments.useQuery(
    { departmentId, includeArchived: false },
    { enabled: !!departmentId }
  );

  const uploadMutation = trpc.knowledgeBase.uploadDocument.useMutation();
  const archiveMutation = trpc.knowledgeBase.archiveDocument.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit
        toast.error("File size must be less than 50MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setIsUploading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();

      await uploadMutation.mutateAsync({
        departmentId,
        title,
        description,
        tags,
        fileBuffer: new Uint8Array(buffer) as any,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
      });

      toast.success("Document uploaded successfully");
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setTags("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      getDocumentsQuery.refetch();
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleArchive = async (documentId: number) => {
    try {
      await archiveMutation.mutateAsync({ documentId });
      toast.success("Document archived");
      getDocumentsQuery.refetch();
    } catch (error) {
      console.error("Archive failed:", error);
      toast.error("Failed to archive document");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Knowledge Base Management</h2>
        <p className="text-gray-600 mt-1">Upload and manage department-specific documentation for AI training</p>
      </div>

      {/* Upload Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Upload New Document</h3>

        <div className="space-y-4">
          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>IT Support</option>
              <option value={2}>HR Support</option>
              <option value={3}>Finance Support</option>
            </select>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Title</label>
            <Input
              placeholder="e.g., IT Troubleshooting Guide"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              placeholder="Brief description of the document content..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>

          {/* Tags Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags (Optional)</label>
            <Input
              placeholder="e.g., troubleshooting, network, security"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document File</label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={isUploading}
                accept=".pdf,.txt,.doc,.docx"
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="gap-2">
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Documents List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>

        {getDocumentsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : getDocumentsQuery.data?.documents && getDocumentsQuery.data.documents.length > 0 ? (
          <div className="space-y-2">
            {getDocumentsQuery.data.documents.map((doc: Document) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{doc.title}</h4>
                    <p className="text-sm text-gray-600">
                      {doc.fileName} • {formatFileSize(doc.fileSize)}
                    </p>
                    {doc.description && (
                      <p className="text-sm text-gray-500 truncate">{doc.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      doc.status === "ready"
                        ? "bg-green-100 text-green-800"
                        : doc.status === "processing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {doc.status}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchive(doc.id)}
                    disabled={archiveMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No documents uploaded yet</p>
            <p className="text-sm text-gray-400">Upload your first document to get started</p>
          </div>
        )}
      </Card>
    </div>
  );
}

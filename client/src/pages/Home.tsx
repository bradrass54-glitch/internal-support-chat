import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Send, Clock, LogOut, Menu, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

interface Message {
  id: number;
  content: string;
  senderType: "user" | "agent" | "system";
  isAIGenerated: boolean;
  createdAt: Date;
}

interface Alert {
  id: number;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TRPC hooks - only fetch departments when authenticated
  const departmentsQuery = trpc.support.getDepartments.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const createConversationMutation = trpc.support.createConversation.useMutation();
  const addMessageMutation = trpc.support.addMessage.useMutation();
  const getMessagesQuery = trpc.support.getMessages.useQuery(
    { conversationId: conversationId || 0, limit: 50 },
    { enabled: !!conversationId && isAuthenticated }
  );
  const getAlertsQuery = trpc.support.getAlerts.useQuery(
    { departmentId: selectedDepartment || 0 },
    { enabled: !!selectedDepartment && isAuthenticated }
  );

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages when conversation changes
  useEffect(() => {
    if (getMessagesQuery.data) {
      setMessages(
        getMessagesQuery.data.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }))
      );
    }
  }, [getMessagesQuery.data]);

  // Load alerts when department changes
  useEffect(() => {
    if (getAlertsQuery.data) {
      setAlerts(getAlertsQuery.data);
    }
  }, [getAlertsQuery.data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Internal Support Chat</h1>
          <p className="text-lg text-gray-600 mb-8">Get instant help from our AI-powered support system</p>
        </div>
        <Button size="lg" onClick={() => {
          const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
          const appId = import.meta.env.VITE_APP_ID;
          const redirectUri = `${window.location.origin}/api/oauth/callback`;
          const state = btoa(redirectUri);
          const url = new URL(`${oauthPortalUrl}/app-auth`);
          url.searchParams.set("appId", appId);
          url.searchParams.set("redirectUri", redirectUri);
          url.searchParams.set("state", state);
          url.searchParams.set("type", "signIn");
          window.location.href = url.toString();
        }}>
          Sign In to Continue
        </Button>
      </div>
    );
  }

  // Create new conversation
  const handleCreateConversation = async (deptId: number) => {
    setSelectedDepartment(deptId);
    setShowMobileMenu(false);
    try {
      const conversation = await createConversationMutation.mutateAsync({
        departmentId: deptId,
        title: `Support - ${new Date().toLocaleDateString()}`,
      });
      if (conversation) {
        setConversationId(conversation.id);
      }
      setMessages([]);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !conversationId) return;

    const userMessage: Message = {
      id: Date.now(),
      content: inputValue,
      senderType: "user",
      isAIGenerated: false,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Add user message
      await addMessageMutation.mutateAsync({
        conversationId,
        content: inputValue,
        isAIGenerated: false,
      });

      // Simulate AI response (in production, this would call the AI service)
      setTimeout(() => {
        const aiMessage: Message = {
          id: Date.now() + 1,
          content: "Thank you for your message. I'm processing your request and will provide a response shortly. If you need immediate assistance, I can escalate this to a live agent.",
          senderType: "system",
          isAIGenerated: true,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsLoading(false);
    }
  };

  // Render message with appropriate styling
  const renderMessage = (msg: Message) => {
    const isUser = msg.senderType === "user";
    const isAI = msg.isAIGenerated;

    return (
      <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            isUser ? "bg-blue-500 text-white" : isAI ? "bg-green-100 text-gray-900" : "bg-gray-200 text-gray-900"
          }`}
        >
          <p className="text-sm">{msg.content}</p>
          <p className="text-xs mt-1 opacity-70">{msg.createdAt.toLocaleTimeString()}</p>
          {isAI && <Badge className="mt-2 text-xs">AI Generated</Badge>}
        </div>
      </div>
    );
  };

  // If departments haven't loaded yet, show loading state
  if (!departmentsQuery.data && !departmentsQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!selectedDepartment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Internal Support Chat</h1>
              <p className="text-lg text-gray-600">Get instant help from our AI-powered support system</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
          {/* Department Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {departmentsQuery.isLoading || departmentsQuery.isPending ? (
              <div className="col-span-full flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : departmentsQuery.isError ? (
              <div className="col-span-full text-center">
                <p className="text-red-600 mb-4">Failed to load departments. Please refresh the page.</p>
                <Button onClick={() => departmentsQuery.refetch()}>Retry</Button>
              </div>
            ) : (
              departmentsQuery.data?.map((dept: any) => (
                <Card
                  key={dept.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow hover:border-blue-500"
                  onClick={() => handleCreateConversation(dept.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{dept.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">{dept.description}</p>
                    <Button className="w-full">Start Chat</Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {departmentsQuery.data?.find((d: any) => d.id === selectedDepartment)?.name}
            </h1>
            <p className="text-sm text-gray-600">Chat with our AI support agent</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden md:inline">{user?.name}</span>
            <Button variant="outline" onClick={() => setSelectedDepartment(null)}>
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Active Alerts
            </h3>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.severity === "critical"
                      ? "bg-red-50 border-red-500"
                      : alert.severity === "high"
                        ? "bg-orange-50 border-orange-500"
                        : "bg-yellow-50 border-yellow-500"
                  }`}
                >
                  <p className="font-semibold text-sm">{alert.title}</p>
                  <p className="text-sm text-gray-700">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Start a conversation by typing your question below</p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your question or describe your issue..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            💡 Tip: Our AI analyzes your question and provides answers based on our documentation. For urgent issues, you can request escalation to a live agent.
          </p>
        </div>
      </div>
    </div>
  );
}

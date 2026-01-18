import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Send, LogOut, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

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
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TRPC hooks
  const getMainConversationQuery = trpc.support.getMainConversation.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const sendMessageMutation = trpc.support.sendMessage.useMutation();
  const getMessagesQuery = trpc.support.getMessages.useQuery(
    { conversationId: conversationId || 0, limit: 50 },
    { enabled: !!conversationId && isAuthenticated }
  );
  const getAlertsQuery = trpc.support.getAlerts.useQuery(
    { limit: 5 },
    { enabled: isAuthenticated }
  );

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    if (getMainConversationQuery.data && !conversationId) {
      setConversationId(getMainConversationQuery.data.id);
    }
  }, [getMainConversationQuery.data, conversationId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (getMessagesQuery.data) {
      setMessages(
        getMessagesQuery.data.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          senderType: msg.senderType,
          isAIGenerated: msg.isAIGenerated,
          createdAt: new Date(msg.createdAt),
        }))
      );
    }
  }, [getMessagesQuery.data]);

  // Load alerts
  useEffect(() => {
    if (getAlertsQuery.data) {
      setAlerts(getAlertsQuery.data);
    }
  }, [getAlertsQuery.data]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !conversationId || isLoading) return;

    setIsLoading(true);
    const userMessage = inputValue;
    setInputValue("");

    try {
      const result = await sendMessageMutation.mutateAsync({
        content: userMessage,
        conversationId,
      });

      // Add messages to display
      if (result.userMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: result.userMessage.id,
            content: result.userMessage.content,
            senderType: "user",
            isAIGenerated: false,
            createdAt: new Date(result.userMessage.createdAt),
          },
        ]);
      }

      if (result.assistantMessage && result.assistantMessage !== null) {
        setMessages((prev) => [
          ...prev,
          {
            id: result.assistantMessage!.id,
            content: result.assistantMessage!.content,
            senderType: "system",
            isAIGenerated: true,
            createdAt: new Date(result.assistantMessage!.createdAt),
          },
        ]);
      }

      // Refresh alerts in case new patterns were detected
      getAlertsQuery.refetch();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
        <Button
          size="lg"
          onClick={() => {
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
          }}
        >
          Sign In to Continue
        </Button>
      </div>
    );
  }

  // Loading state while initializing conversation
  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Internal Support Chat</h1>
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

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Known Issues & Solutions
            </h3>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <Card key={alert.id} className="bg-white border-l-4 border-l-yellow-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{alert.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      </div>
                      <Badge
                        variant={
                          alert.severity === "critical"
                            ? "destructive"
                            : alert.severity === "high"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <Card className="flex-1 flex flex-col mb-6 overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Start a conversation by typing a message below</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.senderType === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-gray-200 text-gray-900 rounded-bl-none"
                    }`}
                  >
                    {msg.isAIGenerated ? (
                      <Streamdown>{msg.content}</Streamdown>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    <p className="text-xs mt-1 opacity-70">
                      {msg.createdAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </CardContent>
        </Card>

        {/* Input Area */}
        <div className="flex gap-2">
          <Input
            placeholder="Type your question or request..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

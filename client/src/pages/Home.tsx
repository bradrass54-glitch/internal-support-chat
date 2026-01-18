import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, LogOut, Loader2, Menu, X, Plus, MessageSquare } from "lucide-react";
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

interface Conversation {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isMobile, setIsMobile] = useState(false);
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
  const getConversationHistoryQuery = trpc.support.getConversationHistory.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  // Load conversation history
  useEffect(() => {
    if (getConversationHistoryQuery.data) {
      setConversations(
        getConversationHistoryQuery.data.map((conv: any) => ({
          id: conv.id,
          title: conv.title,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
        }))
      );
    }
  }, [getConversationHistoryQuery.data]);

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
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
    getMainConversationQuery.refetch();
  };

  const handleSelectConversation = (convId: number) => {
    setConversationId(convId);
    getMessagesQuery.refetch();
    if (isMobile) setSidebarOpen(false);
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Internal Support Chat</h1>
          <p className="text-base md:text-lg text-gray-600 mb-8">Get instant help from our AI-powered support system</p>
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
          className="w-full md:w-auto"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 md:z-auto inset-y-0 left-0 w-64 bg-gray-900 text-white transition-transform duration-300 transform flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Chat History</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-gray-800 rounded md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className="m-4 flex items-center justify-center gap-2 w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-sm md:text-base"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-2">
          {conversations.length === 0 ? (
            <p className="text-gray-400 text-sm p-2">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors truncate text-sm md:text-base ${
                  conversationId === conv.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
                title={conv.title}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <div className="text-xs text-gray-400 truncate">{user?.name}</div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              >
                <Menu className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Support Chat</h1>
              <p className="text-xs md:text-sm text-gray-600 hidden sm:block">AI-powered assistance for IT, HR, and Finance</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
              <MessageSquare className="w-12 h-12 md:w-16 md:h-16 mb-4 text-gray-300" />
              <p className="text-base md:text-lg font-medium">Start a conversation</p>
              <p className="text-xs md:text-sm text-center">Ask me anything about IT, HR, or Finance support</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs sm:max-w-sm md:max-w-2xl px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm md:text-base ${
                    msg.senderType === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-200 text-gray-900 rounded-bl-none"
                  }`}
                >
                  {msg.isAIGenerated ? (
                    <div className="prose prose-sm max-w-none text-inherit">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  <p className="text-xs mt-1 md:mt-2 opacity-70">
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
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-3 md:p-6">
          <div className="max-w-4xl mx-auto flex gap-2 md:gap-3">
            <Input
              placeholder="Type your question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="flex-1 text-sm md:text-base"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="gap-2 px-3 md:px-6 text-sm md:text-base"
              size="sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

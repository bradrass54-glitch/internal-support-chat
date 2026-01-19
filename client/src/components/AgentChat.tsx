import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Phone, X } from "lucide-react";
import { toast } from "sonner";

interface AgentChatProps {
  conversationId: number;
  userId: number;
  agentId: number;
  onClose: () => void;
  onTransfer?: () => void;
}

interface ChatMessage {
  type: "agent-message" | "user-message" | "agent-typing" | "typing-indicator" | "agent-join" | "agent-leave";
  senderId?: number;
  conversationId: number;
  content?: string;
  isTyping?: boolean;
  agentId?: number;
}

export function AgentChat({ conversationId, userId, agentId, onClose, onTransfer }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?type=agent&userId=${agentId}&conversationId=${conversationId}`;

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("[Agent Chat] Connected to WebSocket");
        setIsConnected(true);
        toast.success("Connected to user");
      };

      ws.current.onmessage = (event) => {
        try {
          const message: ChatMessage = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);

          if (message.type === "agent-typing") {
            setAgentTyping(message.isTyping || false);
          }

          if (message.type === "typing-indicator") {
            // User is typing
          }
        } catch (error) {
          console.error("[Agent Chat] Failed to parse message:", error);
        }
      };

      ws.current.onerror = (error) => {
        console.error("[Agent Chat] WebSocket error:", error);
        toast.error("Connection error");
        setIsConnected(false);
      };

      ws.current.onclose = () => {
        console.log("[Agent Chat] Disconnected from WebSocket");
        setIsConnected(false);
      };

      return () => {
        if (ws.current) {
          ws.current.close();
        }
      };
    } catch (error) {
      console.error("[Agent Chat] Failed to connect:", error);
      toast.error("Failed to connect to chat");
    }
  }, [conversationId, agentId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !ws.current || !isConnected) return;

    const message: ChatMessage = {
      type: "agent-message",
      conversationId,
      content: inputValue,
    };

    try {
      ws.current.send(JSON.stringify(message));
      setInputValue("");
      setIsTyping(false);
    } catch (error) {
      console.error("[Agent Chat] Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleTyping = (value: string) => {
    setInputValue(value);

    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      if (ws.current && isConnected) {
        ws.current.send(
          JSON.stringify({
            type: "agent-typing",
            conversationId,
            isTyping: true,
          })
        );
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (ws.current && isConnected) {
        ws.current.send(
          JSON.stringify({
            type: "agent-typing",
            conversationId,
            isTyping: false,
          })
        );
      }
    }, 1000);
  };

  const handleCloseChat = () => {
    if (ws.current && isConnected) {
      ws.current.send(
        JSON.stringify({
          type: "chat-closed",
          conversationId,
          reason: "Agent ended the chat",
        })
      );
    }
    onClose();
  };

  return (
    <Card className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-green-500" />
          <div>
            <p className="font-semibold text-sm">Agent Chat</p>
            <p className={`text-xs ${isConnected ? "text-green-600" : "text-red-600"}`}>
              {isConnected ? "Connected" : "Disconnected"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onTransfer && (
            <Button variant="outline" size="sm" onClick={onTransfer}>
              Transfer
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleCloseChat}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => {
            if (msg.type === "agent-join") {
              return (
                <div key={idx} className="text-center text-xs text-slate-500 py-2">
                  Agent joined the conversation
                </div>
              );
            }

            if (msg.type === "agent-leave") {
              return (
                <div key={idx} className="text-center text-xs text-slate-500 py-2">
                  Agent left the conversation
                </div>
              );
            }

            if (msg.type === "agent-message") {
              return (
                <div key={idx} className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2 max-w-xs">
                    <p className="text-sm text-slate-900 dark:text-slate-100">{msg.content}</p>
                  </div>
                </div>
              );
            }

            if (msg.type === "user-message") {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="bg-blue-500 rounded-lg px-4 py-2 max-w-xs">
                    <p className="text-sm text-white">{msg.content}</p>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {agentTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!isConnected}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !inputValue.trim()}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { conversations, messages, escalationTickets, users } from "../../drizzle/schema";
import * as supportService from "./supportService";

/**
 * WebSocket message types for agent-user communication
 */
export type WebSocketMessage =
  | { type: "agent-join"; agentId: number; conversationId: number }
  | { type: "agent-leave"; agentId: number; conversationId: number }
  | { type: "agent-message"; agentId: number; conversationId: number; content: string }
  | { type: "user-message"; userId: number; conversationId: number; content: string }
  | { type: "typing-indicator"; userId: number; conversationId: number; isTyping: boolean }
  | { type: "agent-typing"; agentId: number; conversationId: number; isTyping: boolean }
  | { type: "escalation-accepted"; agentId: number; conversationId: number }
  | { type: "escalation-transferred"; conversationId: number; fromAgentId: number; toAgentId: number }
  | { type: "chat-closed"; conversationId: number; reason: string };

/**
 * Agent session tracking
 */
interface AgentSession {
  agentId: number;
  conversationId: number;
  ws: WebSocket;
  connectedAt: Date;
  isActive: boolean;
}

/**
 * User connection tracking
 */
interface UserConnection {
  userId: number;
  conversationId: number;
  ws: WebSocket;
  connectedAt: Date;
}

/**
 * WebSocket Service - manages real-time agent-user communication
 */
export class WebSocketService {
  private wss: WebSocketServer;
  private agentSessions: Map<string, AgentSession> = new Map();
  private userConnections: Map<string, UserConnection> = new Map();
  private conversationAgents: Map<number, Set<number>> = new Map(); // conversationId -> Set of agentIds

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupConnectionHandler();
  }

  /**
   * Setup WebSocket connection handler
   */
  private setupConnectionHandler() {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userType = url.searchParams.get("type"); // "agent" or "user"
      const userId = url.searchParams.get("userId");
      const conversationId = url.searchParams.get("conversationId");

      if (!userType || !userId || !conversationId) {
        ws.close(1008, "Missing required parameters");
        return;
      }

      if (userType === "agent") {
        this.handleAgentConnection(ws, parseInt(userId), parseInt(conversationId));
      } else if (userType === "user") {
        this.handleUserConnection(ws, parseInt(userId), parseInt(conversationId));
      } else {
        ws.close(1008, "Invalid user type");
      }
    });
  }

  /**
   * Handle agent WebSocket connection
   */
  private handleAgentConnection(ws: WebSocket, agentId: number, conversationId: number) {
    const sessionKey = `agent-${agentId}-${conversationId}`;

    const session: AgentSession = {
      agentId,
      conversationId,
      ws,
      connectedAt: new Date(),
      isActive: true,
    };

    this.agentSessions.set(sessionKey, session);

    // Track agents per conversation
    if (!this.conversationAgents.has(conversationId)) {
      this.conversationAgents.set(conversationId, new Set());
    }
    this.conversationAgents.get(conversationId)!.add(agentId);

    console.log(`[WebSocket] Agent ${agentId} connected to conversation ${conversationId}`);

    // Notify user that agent joined
    this.broadcastToConversation(conversationId, {
      type: "agent-join",
      agentId,
      conversationId,
    } as WebSocketMessage);

    // Handle incoming messages from agent
    ws.on("message", async (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage;
        await this.handleAgentMessage(message, session);
      } catch (error) {
        console.error("[WebSocket] Error handling agent message:", error);
      }
    });

    // Handle agent disconnect
    ws.on("close", () => {
      this.agentSessions.delete(sessionKey);
      const agents = this.conversationAgents.get(conversationId);
      if (agents) {
        agents.delete(agentId);
        if (agents.size === 0) {
          this.conversationAgents.delete(conversationId);
        }
      }

      console.log(`[WebSocket] Agent ${agentId} disconnected from conversation ${conversationId}`);

      // Notify user that agent left
      this.broadcastToConversation(conversationId, {
        type: "agent-leave",
        agentId,
        conversationId,
      } as WebSocketMessage);
    });

    ws.on("error", (error: Error) => {
      console.error("[WebSocket] Agent connection error:", error);
    });
  }

  /**
   * Handle user WebSocket connection
   */
  private handleUserConnection(ws: WebSocket, userId: number, conversationId: number) {
    const connectionKey = `user-${userId}-${conversationId}`;

    const connection: UserConnection = {
      userId,
      conversationId,
      ws,
      connectedAt: new Date(),
    };

    this.userConnections.set(connectionKey, connection);

    console.log(`[WebSocket] User ${userId} connected to conversation ${conversationId}`);

    // Handle incoming messages from user
    ws.on("message", async (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage;
        await this.handleUserMessage(message, connection);
      } catch (error) {
        console.error("[WebSocket] Error handling user message:", error);
      }
    });

    // Handle user disconnect
    ws.on("close", () => {
      this.userConnections.delete(connectionKey);
      console.log(`[WebSocket] User ${userId} disconnected from conversation ${conversationId}`);
    });

    ws.on("error", (error: Error) => {
      console.error("[WebSocket] User connection error:", error);
    });
  }

  /**
   * Handle message from agent
   */
  private async handleAgentMessage(message: WebSocketMessage, session: AgentSession) {
    const db = await getDb();
    if (!db) return;

    switch (message.type) {
      case "agent-message":
        // Save agent message to database
        await db.insert(messages).values({
          conversationId: session.conversationId,
          senderId: session.agentId,
          content: (message as any).content,
          isAIGenerated: false,
          senderType: "agent",
        });

        // Broadcast to all connected users and agents in this conversation
        this.broadcastToConversation(session.conversationId, message);
        break;

      case "agent-typing":
        // Broadcast typing indicator
        this.broadcastToConversation(session.conversationId, message);
        break;

      case "escalation-accepted":
        // Update escalation ticket status
        await db
          .update(escalationTickets)
          .set({
            status: "in_progress",
            assignedTo: session.agentId,
          })
          .where(eq(escalationTickets.conversationId, session.conversationId));

        this.broadcastToConversation(session.conversationId, message);
        break;

      case "chat-closed":
        // Close the escalation
        await db
          .update(escalationTickets)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
          })
          .where(eq(escalationTickets.conversationId, session.conversationId));

        this.broadcastToConversation(session.conversationId, message);
        break;
    }
  }

  /**
   * Handle message from user
   */
  private async handleUserMessage(message: WebSocketMessage, connection: UserConnection) {
    const db = await getDb();
    if (!db) return;

    switch (message.type) {
      case "user-message":
        // Save user message to database
        await db.insert(messages).values({
          conversationId: connection.conversationId,
          senderId: connection.userId,
          content: (message as any).content,
          isAIGenerated: false,
          senderType: "user",
        });

        // Broadcast to all connected agents in this conversation
        this.broadcastToConversation(connection.conversationId, message);
        break;

      case "typing-indicator":
        // Broadcast typing indicator to agents
        this.broadcastToConversation(connection.conversationId, message);
        break;
    }
  }

  /**
   * Broadcast message to all connections in a conversation
   */
  public broadcastToConversation(conversationId: number, message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);

    // Send to all agents in this conversation
    const agents = this.conversationAgents.get(conversationId);
    if (agents) {
      agents.forEach((agentId) => {
        const sessionKey = `agent-${agentId}-${conversationId}`;
        const session = this.agentSessions.get(sessionKey);
        if (session && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(messageStr);
        }
      });
    }

    // Send to all users in this conversation
    this.userConnections.forEach((connection) => {
      if (
        connection.conversationId === conversationId &&
        connection.ws.readyState === WebSocket.OPEN
      ) {
        connection.ws.send(messageStr);
      }
    });
  }

  /**
   * Send message to specific agent
   */
  public sendToAgent(agentId: number, conversationId: number, message: WebSocketMessage) {
    const sessionKey = `agent-${agentId}-${conversationId}`;
    const session = this.agentSessions.get(sessionKey);
    if (session && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: number, conversationId: number, message: WebSocketMessage) {
    const connectionKey = `user-${userId}-${conversationId}`;
    const connection = this.userConnections.get(connectionKey);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get active agents for a conversation
   */
  public getActiveAgents(conversationId: number): number[] {
    const agents = this.conversationAgents.get(conversationId);
    return agents ? Array.from(agents) : [];
  }

  /**
   * Check if agent is connected to conversation
   */
  public isAgentConnected(agentId: number, conversationId: number): boolean {
    const sessionKey = `agent-${agentId}-${conversationId}`;
    const session = this.agentSessions.get(sessionKey);
    return session ? session.isActive : false;
  }

  /**
   * Disconnect agent from conversation
   */
  public disconnectAgent(agentId: number, conversationId: number) {
    const sessionKey = `agent-${agentId}-${conversationId}`;
    const session = this.agentSessions.get(sessionKey);
    if (session) {
      session.ws.close(1000, "Disconnected by system");
      this.agentSessions.delete(sessionKey);
    }
  }
}

/**
 * Global WebSocket service instance
 */
let wsService: WebSocketService | null = null;

export function initializeWebSocketService(wss: WebSocketServer): WebSocketService {
  wsService = new WebSocketService(wss);
  return wsService;
}

export function getWebSocketService(): WebSocketService | null {
  return wsService;
}

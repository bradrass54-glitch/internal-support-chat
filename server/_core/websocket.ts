import { Server as HTTPServer } from "http";
import { WebSocketServer } from "ws";
import { initializeWebSocketService } from "../services/websocketService";

/**
 * Initialize WebSocket server for real-time agent-user communication
 */
export function initializeWebSocket(httpServer: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Initialize WebSocket service
  initializeWebSocketService(wss);

  console.log("[WebSocket] Server initialized on /ws");

  return wss;
}

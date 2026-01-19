import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { users, escalationTickets, conversations, messages } from "../../drizzle/schema";
import * as supportService from "../services/supportService";
import { getWebSocketService } from "../services/websocketService";

/**
 * Agent router - handles agent operations and escalation management
 * Protected to agent/admin users only
 */
export const agentRouter = router({
  /**
   * Get agent profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user) return null;

    try {
      const agent = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return agent[0] || null;
    } catch (error) {
      console.error("[Agent] Failed to get profile:", error);
      return null;
    }
  }),

  /**
   * Get assigned escalations for agent
   */
  getAssignedEscalations: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "resolved", "closed"]).optional(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) return [];

      const db = await getDb();
      if (!db) return [];

      try {
        const results = await db
          .select({
            ticket: escalationTickets,
            conversation: conversations,
            user: users,
          })
          .from(escalationTickets)
          .innerJoin(conversations, eq(escalationTickets.conversationId, conversations.id))
          .innerJoin(users, eq(conversations.userId, users.id))
          .where(eq(escalationTickets.assignedTo, ctx.user.id))
          .limit(input.limit)
          .offset(input.offset);

        // Filter by status in memory if provided
        let filtered = results;
        if (input.status) {
          filtered = filtered.filter((r) => r.ticket.status === input.status);
        }

        // Already limited above

        return filtered.map((row) => ({
          ticket: {
            ...row.ticket,
            createdAt: new Date(row.ticket.createdAt),
            resolvedAt: row.ticket.resolvedAt ? new Date(row.ticket.resolvedAt) : null,
          },
          conversation: {
            ...row.conversation,
            createdAt: new Date(row.conversation.createdAt),
            updatedAt: new Date(row.conversation.updatedAt),
            closedAt: row.conversation.closedAt ? new Date(row.conversation.closedAt) : null,
          },
          user: row.user,
        }));
      } catch (error) {
        console.error("[Agent] Failed to get assigned escalations:", error);
        return [];
      }
    }),

  /**
   * Get conversation context for escalation
   */
  getConversationContext: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        // Get conversation
        const conversation = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .limit(1);

        if (!conversation[0]) return null;

        // Get recent messages (last 50)
        const recentMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .limit(50);

        return {
          conversation: {
            ...conversation[0],
            createdAt: new Date(conversation[0].createdAt),
            updatedAt: new Date(conversation[0].updatedAt),
            closedAt: conversation[0].closedAt ? new Date(conversation[0].closedAt) : null,
          },
          messages: recentMessages.map((msg) => ({
            ...msg,
            createdAt: new Date(msg.createdAt),
          })),
        };
      } catch (error) {
        console.error("[Agent] Failed to get conversation context:", error);
        return null;
      }
    }),

  /**
   * Accept escalation and connect to conversation
   */
  acceptEscalation: protectedProcedure
    .input(
      z.object({
        escalationId: z.number(),
        conversationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) return { success: false, error: "Not authenticated" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      try {
        // Verify escalation is assigned to agent
        const ticket = await db
          .select()
          .from(escalationTickets)
          .where(
            and(
              eq(escalationTickets.id, input.escalationId),
              eq(escalationTickets.assignedTo, ctx.user.id)
            )
          )
          .limit(1);

        if (!ticket[0]) {
          return { success: false, error: "Escalation not found or not assigned to you" };
        }

        // Update escalation status
        await db
          .update(escalationTickets)
          .set({
            status: "in_progress",
          })
          .where(eq(escalationTickets.id, input.escalationId));

        // Update conversation status
        await db
          .update(conversations)
          .set({
            status: "escalated",
            escalatedTo: ctx.user.id,
          })
          .where(eq(conversations.id, input.conversationId));

        // Log audit event
        await supportService.logAudit(
          ctx.user.id,
          "ACCEPT_ESCALATION",
          "escalation",
          input.escalationId,
          { conversationId: input.conversationId }
        );

        return { success: true };
      } catch (error) {
        console.error("[Agent] Failed to accept escalation:", error);
        return { success: false, error: "Failed to accept escalation" };
      }
    }),

  /**
   * Close escalation and end chat
   */
  closeEscalation: protectedProcedure
    .input(
      z.object({
        escalationId: z.number(),
        conversationId: z.number(),
        summary: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) return { success: false, error: "Not authenticated" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      try {
        // Close escalation
        await db
          .update(escalationTickets)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
          })
          .where(eq(escalationTickets.id, input.escalationId));

        // Close conversation
        await db
          .update(conversations)
          .set({
            status: "closed",
            closedAt: new Date(),
            summary: input.summary,
          })
          .where(eq(conversations.id, input.conversationId));

        // Log audit event
        await supportService.logAudit(
          ctx.user.id,
          "CLOSE_ESCALATION",
          "escalation",
          input.escalationId,
          { conversationId: input.conversationId, summary: input.summary }
        );

        // Notify via WebSocket
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.broadcastToConversation(input.conversationId, {
            type: "chat-closed",
            conversationId: input.conversationId,
            reason: "Agent closed the chat",
          } as any);
        }

        return { success: true };
      } catch (error) {
        console.error("[Agent] Failed to close escalation:", error);
        return { success: false, error: "Failed to close escalation" };
      }
    }),

  /**
   * Get available agents for routing
   */
  getAvailableAgents: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().optional(),
      })
    )
    .query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        return [];
      }

      const db = await getDb();
      if (!db) return [];

      try {
        // Get all agents (users with role 'agent' or 'admin')
        const agents = await db.select().from(users).where(eq(users.role, "admin") as any);

        return agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
        }));
      } catch (error) {
        console.error("[Agent] Failed to get available agents:", error);
        return [];
      }
    }),

  /**
   * Transfer escalation to another agent
   */
  transferEscalation: protectedProcedure
    .input(
      z.object({
        escalationId: z.number(),
        conversationId: z.number(),
        toAgentId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) return { success: false, error: "Not authenticated" };

      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      try {
        // Verify escalation is assigned to current agent
        const ticket = await db
          .select()
          .from(escalationTickets)
          .where(
            and(
              eq(escalationTickets.id, input.escalationId),
              eq(escalationTickets.assignedTo, ctx.user.id)
            )
          )
          .limit(1);

        if (!ticket[0]) {
          return { success: false, error: "Escalation not found or not assigned to you" };
        }

        // Transfer to new agent
        await db
          .update(escalationTickets)
          .set({
            assignedTo: input.toAgentId,
          })
          .where(eq(escalationTickets.id, input.escalationId));

        // Log audit event
        await supportService.logAudit(
          ctx.user.id,
          "TRANSFER_ESCALATION",
          "escalation",
          input.escalationId,
          { toAgentId: input.toAgentId, reason: input.reason }
        );

        // Notify via WebSocket
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.broadcastToConversation(input.conversationId, {
            type: "escalation-transferred",
            conversationId: input.conversationId,
            fromAgentId: ctx.user.id,
            toAgentId: input.toAgentId,
          } as any);
        }

        return { success: true };
      } catch (error) {
        console.error("[Agent] Failed to transfer escalation:", error);
        return { success: false, error: "Failed to transfer escalation" };
      }
    }),
});

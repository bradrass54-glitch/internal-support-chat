import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { conversations, messages, escalationTickets, users } from "../../drizzle/schema";

/**
 * Admin conversation router - handles viewing and managing conversations
 * Allows admins to view chat history and continue conversations
 */
export const adminConversationRouter = router({
  /**
   * Get all conversations in workspace (for admin browsing)
   */
  getAllConversations: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        let query = db
          .select({
            id: conversations.id,
            title: conversations.title,
            userId: conversations.userId,
            departmentId: conversations.departmentId,
            createdAt: conversations.createdAt,
            updatedAt: conversations.updatedAt,
          })
          .from(conversations)
          .where(eq(conversations.workspaceId, ctx.workspace!.id))
          .orderBy(desc(conversations.updatedAt))
          .limit(input.limit)
          .offset(input.offset);

        const convs = await query;

        return convs.map((conv) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
        }));
      } catch (error) {
        console.error("Error fetching conversations:", error);
        throw new Error("Failed to fetch conversations");
      }
    }),

  /**
   * Get conversation details with full message history
   */
  getConversationWithMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // Get conversation
        const conv = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!conv || conv.length === 0) {
          throw new Error("Conversation not found");
        }

        const conversation = conv[0];

        // Get all messages in conversation
        const convMessages = await db
          .select({
            id: messages.id,
            content: messages.content,
            senderType: messages.senderType,
            isAIGenerated: messages.isAIGenerated,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .orderBy(messages.createdAt);

        // Get escalation info if exists
        const escalation = await db
          .select()
          .from(escalationTickets)
          .where(eq(escalationTickets.conversationId, input.conversationId))
          .limit(1);

        return {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            userId: conversation.userId,
            departmentId: conversation.departmentId,
            createdAt: new Date(conversation.createdAt),
            updatedAt: new Date(conversation.updatedAt),
          },
          messages: convMessages.map((msg) => ({
            ...msg,
            createdAt: new Date(msg.createdAt),
          })),
          escalation: escalation[0] || null,
        };
      } catch (error) {
        console.error("Error fetching conversation details:", error);
        throw new Error("Failed to fetch conversation details");
      }
    }),

  /**
   * Get escalation with conversation history
   */
  getEscalationWithConversation: protectedProcedure
    .input(
      z.object({
        escalationId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // Get escalation
        const escalation = await db
          .select()
          .from(escalationTickets)
          .where(
            and(
              eq(escalationTickets.id, input.escalationId),
              eq(escalationTickets.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!escalation || escalation.length === 0) {
          throw new Error("Escalation not found");
        }

        const ticket = escalation[0];

        // Get conversation
        const conv = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, ticket.conversationId))
          .limit(1);

        if (!conv || conv.length === 0) {
          throw new Error("Conversation not found");
        }

        const conversation = conv[0];

        // Get all messages
        const convMessages = await db
          .select({
            id: messages.id,
            content: messages.content,
            senderType: messages.senderType,
            isAIGenerated: messages.isAIGenerated,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, ticket.conversationId))
          .orderBy(messages.createdAt);

        // Get assigned agent info
        const agent = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, ticket.assignedTo))
          .limit(1);

        return {
          escalation: {
            id: ticket.id,
            conversationId: ticket.conversationId,
            priority: ticket.priority,
            reason: ticket.reason,
            status: ticket.status,
            assignedTo: ticket.assignedTo,
            assignedAgent: agent[0] || null,
            createdAt: new Date(ticket.createdAt),
            resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
          },
          conversation: {
            id: conversation.id,
            title: conversation.title,
            userId: conversation.userId,
            departmentId: conversation.departmentId,
            createdAt: new Date(conversation.createdAt),
            updatedAt: new Date(conversation.updatedAt),
          },
          messages: convMessages.map((msg) => ({
            ...msg,
            createdAt: new Date(msg.createdAt),
          })),
        };
      } catch (error) {
        console.error("Error fetching escalation with conversation:", error);
        throw new Error("Failed to fetch escalation details");
      }
    }),

  /**
   * Send message as admin in a conversation
   */
  sendAdminMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // Verify conversation exists and belongs to workspace
        const conv = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!conv || conv.length === 0) {
          throw new Error("Conversation not found");
        }

        // Insert message
        const result = await db.insert(messages).values({
          conversationId: input.conversationId,
          senderId: ctx.user.id,
          content: input.content,
          senderType: "agent",
          isAIGenerated: false,
          createdAt: new Date(),
        });

        return {
          success: true,
          messageId: result[0].insertId,
        };
      } catch (error) {
        console.error("Error sending admin message:", error);
        throw new Error("Failed to send message");
      }
    }),

  /**
   * Get conversation count for admin dashboard
   */
  getConversationStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      const result = await db
        .select()
        .from(conversations)
        .where(eq(conversations.workspaceId, ctx.workspace!.id));

      return {
        totalConversations: result.length,
        recentConversations: result.filter(
          (c) => new Date(c.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length,
      };
    } catch (error) {
      console.error("Error fetching conversation stats:", error);
      throw new Error("Failed to fetch conversation stats");
    }
  }),
});

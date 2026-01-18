import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as supportService from "../services/supportService";
import * as aiService from "../services/aiService";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

/**
 * Support router - handles unified chat-based support system
 * All messages go into a single conversation per user
 * AI automatically detects department context from messages
 */
export const supportRouter = router({
  /**
   * Get or create user's main support conversation
   */
  getMainConversation: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get user's existing conversation or create new one
      const userConversations = await supportService.getUserConversations(ctx.user.id, 1, 0);

      if (userConversations.length > 0) {
        return userConversations[0];
      }

      // Create new main conversation for user
      const newConversation = await supportService.createConversation(
        ctx.user.id,
        1, // Default to IT department (or could be generic)
        `Support Chat - ${new Date().toLocaleDateString()}`,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );

      return newConversation;
    } catch (error) {
      console.error("[Support] Failed to get main conversation:", error);
      throw error;
    }
  }),

  /**
   * Send a message and get AI response
   * Automatically detects department and generates contextual response
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        content: z.string().min(1).max(5000),
        conversationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Add user message to conversation
        const userMessage = await supportService.addMessage(
          input.conversationId,
          ctx.user.id,
          input.content,
          "user",
          false,
          undefined,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        if (!userMessage) {
          throw new Error("Failed to save user message");
        }

        // Detect department from message
        const detectedDept = await aiService.detectDepartment(input.content);

        // Generate AI response
        const aiResponse = await aiService.generateAIResponse(input.conversationId, input.content);

        // Save AI response to conversation
        const assistantMessage = await supportService.addMessage(
          input.conversationId,
          ctx.user.id,
          aiResponse,
          "system",
          true,
          undefined,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        // Record learning feedback data
        if (assistantMessage) {
          await supportService.recordLearningFeedback(
            assistantMessage.id,
            ctx.user.id,
            "partially_helpful",
            0,
            detectedDept ? `Detected department: ${detectedDept}` : undefined,
            ctx.req.ip,
            ctx.req.get("user-agent")
          );
        }

        return {
          userMessage,
          assistantMessage,
          detectedDepartment: detectedDept,
        };
      } catch (error) {
        console.error("[Support] Failed to send message:", error);
        throw error;
      }
    }),

  /**
   * Get all messages in the conversation
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Verify user owns the conversation
        const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        const msgs = await supportService.getConversationMessages(
          input.conversationId,
          input.limit,
          input.offset
        );

        return msgs;
      } catch (error) {
        console.error("[Support] Failed to get messages:", error);
        return [];
      }
    }),

  /**
   * Get active alerts for the user
   * Shows known issues and solutions
   */
  getAlerts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async () => {
      try {
        const db = await getDb();
        if (!db) return [];

        // Get active alerts (not expired)
        const { alerts } = await import("../../drizzle/schema");
        const alertList = await db
          .select()
          .from(alerts)
          .where(eq(alerts.isActive, true))
          .limit(10);

        return alertList;
      } catch (error) {
        console.error("[Support] Failed to get alerts:", error);
        return [];
      }
    }),

  /**
   * Request escalation to live agent
   */
  escalateConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify user owns the conversation
        const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        // Add escalation request message
        await supportService.addMessage(
          input.conversationId,
          ctx.user.id,
          `Escalation requested: ${input.reason}`,
          "system",
          false,
          undefined,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        // Create escalation ticket
        const escalation = await supportService.escalateConversation(
          input.conversationId,
          ctx.user.id,
          input.reason,
          input.priority,
          ctx.user.id,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        return escalation;
      } catch (error) {
        console.error("[Support] Failed to escalate:", error);
        throw error;
      }
    }),

  /**
   * Rate AI response (for learning)
   */
  rateResponse: protectedProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        feedback: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const feedback = await supportService.recordLearningFeedback(
          input.messageId,
          ctx.user.id,
          input.rating >= 4 ? "helpful" : "not_helpful",
          input.rating,
          input.feedback,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        return feedback;
      } catch (error) {
        console.error("[Support] Failed to rate response:", error);
        throw error;
      }
    }),

  /**
   * Get conversation history for user
   */
  getConversationHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const convs = await supportService.getUserConversations(
          ctx.user.id,
          input.limit,
          input.offset
        );

        return convs;
      } catch (error) {
        console.error("[Support] Failed to get conversation history:", error);
        return [];
      }
    }),

  /**
   * Close a conversation
   */
  closeConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify user owns the conversation
        const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        await supportService.closeConversation(input.conversationId, ctx.user.id);

        return { success: true };
      } catch (error) {
        console.error("[Support] Failed to close conversation:", error);
        throw error;
      }
    }),

  /**
   * Get departments (for reference/admin)
   */
  getDepartments: protectedProcedure.query(async () => {
    return await supportService.getDepartments();
  }),

  /**
   * Get documentation for a department (for AI context)
   */
  getDepartmentDocumentation: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        category: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await supportService.getDepartmentDocumentation(input.departmentId, input.category);
    }),
});

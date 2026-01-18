import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as supportService from "../services/supportService";

/**
 * Support chat router - handles all conversation, escalation, and pattern detection operations
 * All procedures require authentication for security
 */
export const supportRouter = router({
  /**
   * Create a new support conversation
   */
  createConversation: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await supportService.createConversation(
        ctx.user.id,
        input.departmentId,
        input.title,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return conversation;
    }),

  /**
   * Get a specific conversation (with security check)
   */
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
      if (!conversation) {
        throw new Error("Conversation not found or access denied");
      }
      return conversation;
    }),

  /**
   * Get user's conversations
   */
  getUserConversations: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      return await supportService.getUserConversations(
        ctx.user.id,
        input.departmentId,
        input.limit,
        input.offset
      );
    }),

  /**
   * Add a message to a conversation
   */
  addMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        content: z.string().min(1).max(5000),
        isAIGenerated: z.boolean().default(false),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user owns the conversation
      const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
      if (!conversation) {
        throw new Error("Conversation not found or access denied");
      }

      const message = await supportService.addMessage(
        input.conversationId,
        ctx.user.id,
        input.content,
        "user" as const,
        input.isAIGenerated,
        input.metadata,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return message;
    }),

  /**
   * Get conversation messages
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
      // Verify user owns the conversation
      const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
      if (!conversation) {
        throw new Error("Conversation not found or access denied");
      }

      return await supportService.getConversationMessages(
        input.conversationId,
        input.limit,
        input.offset
      );
    }),

  /**
   * Escalate conversation to a live agent
   */
  escalateConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        agentId: z.number().int().positive(),
        reason: z.string().min(1).max(1000),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user owns the conversation
      const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
      if (!conversation) {
        throw new Error("Conversation not found or access denied");
      }

      const escalation = await supportService.escalateConversation(
        input.conversationId,
        input.agentId,
        input.reason,
        input.priority,
        ctx.user.id,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return escalation;
    }),

  /**
   * Close a conversation
   */
  closeConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        summary: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user owns the conversation
      const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
      if (!conversation) {
        throw new Error("Conversation not found or access denied");
      }

      await supportService.closeConversation(
        input.conversationId,
        ctx.user.id,
        input.summary,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return { success: true };
    }),

  /**
   * Get active alerts for a department
   */
  getAlerts: protectedProcedure
    .input(z.object({ departmentId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return await supportService.getActiveAlerts(input.departmentId);
    }),

  /**
   * Record feedback on AI-generated response
   */
  recordFeedback: protectedProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        feedback: z.enum(["helpful", "not_helpful", "partially_helpful"]),
        rating: z.number().int().min(1).max(5).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const interaction = await supportService.recordLearningFeedback(
        input.messageId,
        ctx.user.id,
        input.feedback,
        input.rating,
        input.notes,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return interaction;
    }),

  /**
   * Get departments
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

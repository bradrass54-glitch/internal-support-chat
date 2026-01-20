import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as supportService from "../services/supportService";
import * as aiService from "../services/aiService";
import * as aiStreamingService from "../services/aiStreamingService";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { alerts } from "../../drizzle/schema";

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
        ctx.workspace?.id || 1, // Use workspace ID from context
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
   * Send a message and stream AI response in real-time
   */
  sendMessageStreaming: protectedProcedure
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

        // Generate AI response with streaming
        let fullResponse = "";
        await aiStreamingService.generateAIResponseStreaming(
          input.conversationId,
          input.content,
          async (chunk: string) => {
            fullResponse += chunk;
          }
        );

        // Save AI response to conversation
        const assistantMessage = await supportService.addMessage(
          input.conversationId,
          ctx.user.id,
          fullResponse,
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
        console.error("[Support] Failed to send streaming message:", error);
        throw error;
      }
    }),

  /**
   * Get messages for a conversation
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Verify user has access to this conversation
        const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        return await supportService.getConversationMessages(input.conversationId, input.limit, input.offset);
      } catch (error) {
        console.error("[Support] Failed to get messages:", error);
        throw error;
      }
    }),

  /**
   * Get conversation history for user
   */
  getConversationHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        return await supportService.getUserConversations(ctx.user.id, input.limit, input.offset);
      } catch (error) {
        console.error("[Support] Failed to get conversation history:", error);
        throw error;
      }
    }),

  /**
   * Escalate a conversation to a live agent
   */
  escalateConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify user owns the conversation
        const conversation = await supportService.getConversation(input.conversationId, ctx.user.id);
        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        // Create escalation ticket
        const escalation = await supportService.escalateConversation(
          ctx.workspace?.id || 1,
          input.conversationId,
          ctx.user.id,
          input.reason || "User requested escalation",
          "high",
          ctx.user.id,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        return escalation;
      } catch (error) {
        console.error("[Support] Failed to escalate conversation:", error);
        throw error;
      }
    }),

  /**
   * Submit feedback on AI response
   */
  submitFeedback: protectedProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await supportService.recordLearningFeedback(
          input.messageId,
          ctx.user.id,
          input.rating >= 4 ? "helpful" : input.rating >= 3 ? "partially_helpful" : "not_helpful",
          input.rating,
          input.comment,
          ctx.req.ip,
          ctx.req.get("user-agent")
        );
      } catch (error) {
        console.error("[Support] Failed to submit feedback:", error);
        throw error;
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

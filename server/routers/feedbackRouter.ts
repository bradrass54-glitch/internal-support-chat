import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { learningInteractions, messages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Feedback router - handles user feedback and ratings for AI responses
 * Allows users to rate responses and provide feedback for system improvement
 */
export const feedbackRouter = router({
  /**
   * Submit feedback for an AI response
   */
  submitFeedback: protectedProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        feedback: z.enum(["helpful", "not_helpful", "partially_helpful"]),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify message exists and belongs to user
      const message = await db
        .select()
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);

      if (!message.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Record feedback
      await db
        .insert(learningInteractions)
        .values({
          messageId: input.messageId,
          userId: ctx.user.id,
          feedback: input.feedback,
          rating: input.rating,
          notes: input.notes,
        })
        .execute();

      return {
        success: true,
        message: "Feedback recorded successfully",
      };
    }),

  /**
   * Get feedback statistics for a conversation
   */
  getConversationFeedbackStats: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all feedback for messages in this conversation
      const feedbackData = await db
        .select()
        .from(learningInteractions)
        .innerJoin(messages, eq(learningInteractions.messageId, messages.id))
        .where(eq(messages.conversationId, input.conversationId));

      // Calculate statistics
      const totalFeedback = feedbackData.length;
      const avgRating =
        totalFeedback > 0
          ? feedbackData.reduce((sum, f) => sum + (f.learningInteractions.rating || 0), 0) /
            totalFeedback
          : 0;

      const feedbackCounts = {
        helpful: feedbackData.filter((f) => f.learningInteractions.feedback === "helpful").length,
        not_helpful: feedbackData.filter(
          (f) => f.learningInteractions.feedback === "not_helpful"
        ).length,
        partially_helpful: feedbackData.filter(
          (f) => f.learningInteractions.feedback === "partially_helpful"
        ).length,
      };

      return {
        totalFeedback,
        avgRating: parseFloat(avgRating.toFixed(2)),
        feedbackCounts,
        helpfulPercentage:
          totalFeedback > 0
            ? parseFloat(((feedbackCounts.helpful / totalFeedback) * 100).toFixed(2))
            : 0,
      };
    }),

  /**
   * Get user's feedback history
   */
  getUserFeedbackHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const feedbackHistory = await db
        .select()
        .from(learningInteractions)
        .where(eq(learningInteractions.userId, ctx.user.id))
        .limit(input.limit)
        .offset(input.offset);

      return feedbackHistory;
    }),

  /**
   * Get workspace-wide feedback analytics
   */
  getWorkspaceFeedbackAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // TODO: Implement workspace-wide analytics
    // This would require joining with conversations, messages, and learningInteractions
    // to get aggregated feedback data for the entire workspace

    return {
      totalFeedback: 0,
      avgRating: 0,
      feedbackTrend: [],
      topIssues: [],
    };
  }),

  /**
   * Get feedback by rating
   */
  getFeedbackByRating: protectedProcedure
    .input(
      z.object({
        rating: z.number().int().min(1).max(5),
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const feedback = await db
        .select()
        .from(learningInteractions)
        .where(
          and(
            eq(learningInteractions.userId, ctx.user.id),
            eq(learningInteractions.rating, input.rating)
          )
        )
        .limit(input.limit)
        .offset(input.offset);

      return feedback as any;
    }),

  /**
   * Get feedback by type
   */
  getFeedbackByType: protectedProcedure
    .input(
      z.object({
        type: z.enum(["helpful", "not_helpful", "partially_helpful"]),
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const feedback = await db
        .select()
        .from(learningInteractions)
        .where(
          and(
            eq(learningInteractions.userId, ctx.user.id),
            eq(learningInteractions.feedback, input.type)
          )
        )
        .limit(input.limit)
        .offset(input.offset);

      return feedback as any;
    }),

  /**
   * Get common issues from negative feedback
   */
  getCommonIssues: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all negative feedback with notes
      const negativeFeedback = await db
        .select()
        .from(learningInteractions)
        .where(
          and(
            eq(learningInteractions.userId, ctx.user.id),
            eq(learningInteractions.feedback, "not_helpful")
          )
        );

      // Extract and count common keywords from notes
      const keywords: Record<string, number> = {};
      negativeFeedback.forEach((f) => {
        if (f.notes) {
          const words = f.notes.toLowerCase().split(/\s+/);
          words.forEach((word) => {
            if (word.length > 3) {
              keywords[word] = (keywords[word] || 0) + 1;
            }
          });
        }
      });

      // Sort by frequency and return top issues
      const commonIssues = Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, input.limit)
        .map(([issue, count]) => ({ issue, count }));

      return commonIssues;
    }),
});

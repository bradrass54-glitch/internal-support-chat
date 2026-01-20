import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { conversations, messages } from "../../drizzle/schema";
import { eq, and, like, gte, lte, or, SQL } from "drizzle-orm";

/**
 * Conversation search router - handles searching and filtering conversations
 * Allows users to find past conversations by keywords, date, or status
 */
export const conversationSearchRouter = router({
  /**
   * Search conversations by keywords
   * Searches in conversation titles and message content
   */
  searchConversations: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Search in conversation titles
      const searchResults = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, ctx.workspace!.id),
            eq(conversations.userId, ctx.user.id),
            like(conversations.title, `%${input.query}%`)
          )
        )
        .limit(input.limit)
        .offset(input.offset);

      // TODO: Also search in message content and return matching conversations
      // This would require a more complex query that joins conversations with messages

      return searchResults;
    }),

  /**
   * Filter conversations by date range
   */
  filterByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, ctx.workspace!.id),
            eq(conversations.userId, ctx.user.id),
            gte(conversations.createdAt, input.startDate),
            lte(conversations.createdAt, input.endDate)
          )
        )
        .limit(input.limit)
        .offset(input.offset);

      return results;
    }),

  /**
   * Filter conversations by status
   */
  filterByStatus: protectedProcedure
    .input(
      z.object({
        status: z.enum(["open", "escalated", "closed", "pending"]),
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, ctx.workspace!.id),
            eq(conversations.userId, ctx.user.id),
            eq(conversations.status, input.status)
          )
        )
        .limit(input.limit)
        .offset(input.offset);

      return results;
    }),

  /**
   * Advanced search with multiple filters
   */
  advancedSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        status: z.enum(["open", "escalated", "closed", "pending"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        isEscalated: z.boolean().optional(),
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: SQL[] = [
        eq(conversations.workspaceId, ctx.workspace!.id),
        eq(conversations.userId, ctx.user.id),
      ];

      // Add query filter
      if (input.query) {
        conditions.push(like(conversations.title, `%${input.query}%`));
      }

      // Add status filter
      if (input.status) {
        conditions.push(eq(conversations.status, input.status));
      }

      // Add date range filter
      if (input.startDate) {
        conditions.push(gte(conversations.createdAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(conversations.createdAt, input.endDate));
      }

      // Add escalation filter
      if (input.isEscalated !== undefined) {
        if (input.isEscalated) {
          conditions.push(eq(conversations.status, "escalated"));
        } else {
          const orCondition = or(
            eq(conversations.status, "open"),
            eq(conversations.status, "closed"),
            eq(conversations.status, "pending")
          );
          if (orCondition) {
            conditions.push(orCondition);
          }
        }
      }
      const results = await db
        .select()
        .from(conversations)
        .where(and(...(conditions.filter((c) => c !== undefined) as SQL[])))
        .limit(input.limit)
        .offset(input.offset);

      return results;
    }),

  /**
   * Get conversation statistics
   */
  getConversationStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allConversations = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, ctx.workspace!.id),
          eq(conversations.userId, ctx.user.id)
        )
      );

    const stats = {
      total: allConversations.length,
      open: allConversations.filter((c) => c.status === "open").length,
      escalated: allConversations.filter((c) => c.status === "escalated").length,
      closed: allConversations.filter((c) => c.status === "closed").length,
      pending: allConversations.filter((c) => c.status === "pending").length,
    };

    return stats;
  }),

  /**
   * Export conversations as CSV or JSON
   */
  exportConversations: protectedProcedure
    .input(
      z.object({
        format: z.enum(["csv", "json"]),
        filters: z
          .object({
            status: z.enum(["open", "escalated", "closed", "pending"]).optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: SQL[] = [
        eq(conversations.workspaceId, ctx.workspace!.id),
        eq(conversations.userId, ctx.user.id),
      ];

      if (input.filters?.status) {
        conditions.push(eq(conversations.status, input.filters.status));
      }
      if (input.filters?.startDate) {
        conditions.push(gte(conversations.createdAt, input.filters.startDate));
      }
      if (input.filters?.endDate) {
        conditions.push(lte(conversations.createdAt, input.filters.endDate));
      }

      const results = await db
        .select()
        .from(conversations)
        .where(and(...(conditions.filter((c) => c !== undefined) as SQL[])));

      // Format based on requested format
      if (input.format === "json") {
        return {
          format: "json",
          data: results,
          exportedAt: new Date().toISOString(),
        };
      } else {
        // CSV format
        const headers = ["ID", "Title", "Status", "Created At", "Updated At"];
        const rows = results.map((c) => [
          c.id,
          c.title || "",
          c.status,
          new Date(c.createdAt).toISOString(),
          new Date(c.updatedAt).toISOString(),
        ]);

        return {
          format: "csv",
          headers,
          rows,
          exportedAt: new Date().toISOString(),
        };
      }
    }),
});

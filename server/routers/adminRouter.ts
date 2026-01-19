import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, gte, and, count } from "drizzle-orm";
import {
  conversations,
  messages,
  escalationTickets,
  auditLogs,
  patterns,
  documentationSources,
  departments,
} from "../../drizzle/schema";
import * as supportService from "../services/supportService";

/**
 * Admin router - handles dashboard analytics, escalations, and documentation
 * Protected to admin users only
 */
export const adminRouter = router({
  /**
   * Get dashboard analytics summary
   */
  getAnalytics: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(90).default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return null;

      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);

        // Total conversations
        const totalConversations = await db
          .select({ count: count() })
          .from(conversations)
          .where(gte(conversations.createdAt, startDate));

        // Total messages
        const totalMessages = await db
          .select({ count: count() })
          .from(messages)
          .where(gte(messages.createdAt, startDate));

        // Active escalations
        const activeEscalations = await db
          .select({ count: count() })
          .from(escalationTickets)
          .where(
            and(
              gte(escalationTickets.createdAt, startDate),
              eq(escalationTickets.status, "in_progress" as any)
            )
          );

        // Resolved escalations
        const resolvedEscalations = await db
          .select({ count: count() })
          .from(escalationTickets)
          .where(
            and(
              gte(escalationTickets.createdAt, startDate),
              eq(escalationTickets.status, "resolved" as any)
            )
          );

        // AI generated messages
        const aiMessages = await db
          .select({ count: count() })
          .from(messages)
          .where(
            and(
              gte(messages.createdAt, startDate),
              eq(messages.isAIGenerated, true)
            )
          );

        // Detected patterns
        const detectedPatterns = await db
          .select({ count: count() })
          .from(patterns)
          .where(gte(patterns.createdAt, startDate));

        return {
          period: `Last ${input.days} days`,
          totalConversations: totalConversations[0]?.count || 0,
          totalMessages: totalMessages[0]?.count || 0,
          activeEscalations: activeEscalations[0]?.count || 0,
          resolvedEscalations: resolvedEscalations[0]?.count || 0,
          aiGeneratedMessages: aiMessages[0]?.count || 0,
          detectedPatterns: detectedPatterns[0]?.count || 0,
          averageMessagesPerConversation:
            (totalMessages[0]?.count || 0) / Math.max(totalConversations[0]?.count || 1, 1),
        };
      } catch (error) {
        console.error("[Admin] Failed to get analytics:", error);
        return null;
      }
    }),

  /**
   * Get escalations with filters
   */
  getEscalations: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return [];

      try {
        let query = db.select().from(escalationTickets);

        const results = await query.limit(input.limit).offset(input.offset);
        
        // Filter by status and priority in memory
        let filtered = results;
        if (input.status) {
          filtered = filtered.filter((t) => t.status === input.status);
        }
        if (input.priority) {
          filtered = filtered.filter((t) => t.priority === input.priority);
        }

        return filtered.map((ticket) => ({
          ...ticket,
          createdAt: new Date(ticket.createdAt),
          resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
        }));
      } catch (error) {
        console.error("[Admin] Failed to get escalations:", error);
        return [];
      }
    }),

  /**
   * Update escalation status
   */
  updateEscalation: protectedProcedure
    .input(
      z.object({
        escalationId: z.number(),
        status: z.enum(["pending", "in_progress", "resolved", "closed"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return null;

      try {
        const updateData: any = {
          status: input.status,
          updatedAt: new Date(),
        };

        if (input.notes) {
          updateData.resolutionNotes = input.notes;
        }

        if (input.status === "resolved" || input.status === "closed") {
          updateData.resolvedAt = new Date();
        }

        await db
          .update(escalationTickets)
          .set(updateData)
          .where(eq(escalationTickets.id, input.escalationId));

        // Log audit event
        await supportService.logAudit(
          ctx.user?.id,
          "UPDATE_ESCALATION",
          "escalation",
          input.escalationId,
          { status: input.status, notes: input.notes }
        );

        return { success: true };
      } catch (error) {
        console.error("[Admin] Failed to update escalation:", error);
        throw error;
      }
    }),

  /**
   * Get patterns and alerts
   */
  getPatterns: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return [];

      try {
        const results = await db
          .select()
          .from(patterns)
          .limit(input.limit)
          .offset(input.offset);

        return results.map((pattern) => ({
          ...pattern,
          createdAt: new Date(pattern.createdAt),
          updatedAt: new Date(pattern.updatedAt),
        }));
      } catch (error) {
        console.error("[Admin] Failed to get patterns:", error);
        return [];
      }
    }),

  /**
   * Get documentation sources
   */
  getDocumentation: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return [];

      try {
        let query = db.select().from(documentationSources);

        if (input.departmentId) {
          query = query.where(eq(documentationSources.departmentId, input.departmentId)) as any;
        }

        const results = await query.limit(input.limit).offset(input.offset);

        return results.map((doc) => ({
          ...doc,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        }));
      } catch (error) {
        console.error("[Admin] Failed to get documentation:", error);
        return [];
      }
    }),

  /**
   * Add documentation source
   */
  addDocumentation: protectedProcedure
    .input(
      z.object({
        departmentId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        url: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return null;

      try {
        const result = await db.insert(documentationSources).values({
          departmentId: input.departmentId,
          title: input.title,
          content: input.content,
          url: input.url,
        });

        const lastInsertId = (result as any).insertId;

        // Log audit event
        await supportService.logAudit(
          ctx.user?.id,
          "CREATE_DOCUMENTATION",
          "documentation",
          Number(lastInsertId),
          { title: input.title, departmentId: input.departmentId }
        );

        return { success: true, id: lastInsertId };
      } catch (error) {
        console.error("[Admin] Failed to add documentation:", error);
        throw error;
      }
    }),

  /**
   * Delete documentation source
   */
  deleteDocumentation: protectedProcedure
    .input(
      z.object({
        documentationId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return null;

      try {
        await db
          .delete(documentationSources)
          .where(eq(documentationSources.id, input.documentationId));

        // Log audit event
        await supportService.logAudit(
          ctx.user?.id,
          "DELETE_DOCUMENTATION",
          "documentation",
          input.documentationId,
          {}
        );

        return { success: true };
      } catch (error) {
        console.error("[Admin] Failed to delete documentation:", error);
        throw error;
      }
    }),

  /**
   * Get audit logs
   */
  getAuditLogs: protectedProcedure
    .input(
      z.object({
        action: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) return [];

      try {
        let query = db.select().from(auditLogs);

        if (input.action) {
          query = query.where(eq(auditLogs.action, input.action)) as any;
        }

        const results = await query.limit(input.limit).offset(input.offset);

        return results.map((log) => ({
          ...log,
          createdAt: new Date(log.createdAt),
          changes: log.changes ? (typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes) : null,
        }));
      } catch (error) {
        console.error("[Admin] Failed to get audit logs:", error);
        return [];
      }
    }),

  /**
   * Get departments
   */
  getDepartments: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const db = await getDb();
    if (!db) return [];

    try {
      return await db.select().from(departments);
    } catch (error) {
      console.error("[Admin] Failed to get departments:", error);
      return [];
    }
  }),
});

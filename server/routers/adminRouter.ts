import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as supportService from "../services/supportService";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { escalationTickets, auditLogs } from "../../drizzle/schema";

/**
 * Admin router - handles administrative operations for support system
 * All procedures require admin role for security
 */
export const adminRouter = router({
  /**
   * Create a new department
   */
  createDepartment: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const department = await supportService.createDepartment(
        input.name,
        input.description,
        ctx.user.id,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return department;
    }),

  /**
   * Add documentation source for AI training
   */
  addDocumentation: adminProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        url: z.string().url().optional(),
        category: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const doc = await supportService.addDocumentationSource(
        input.departmentId,
        input.title,
        input.content,
        input.url,
        input.category,
        ctx.user.id,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return doc;
    }),

  /**
   * Create a proactive alert
   */
  createAlert: adminProcedure
    .input(
      z.object({
        patternId: z.number().int().positive(),
        departmentId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        severity: z.enum(["low", "medium", "high", "critical"]),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const alert = await supportService.createAlert(
        input.patternId,
        input.departmentId,
        input.title,
        input.message,
        input.severity,
        input.expiresAt,
        ctx.user.id,
        ctx.req.ip,
        ctx.req.get("user-agent")
      );
      return alert;
    }),

  /**
   * Get escalation tickets
   */
  getEscalationTickets: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "resolved", "closed"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        let query = db.select().from(escalationTickets);

        if (input.status) {
          query = query.where(eq(escalationTickets.status, input.status)) as any;
        }

        return await query.limit(input.limit).offset(input.offset);
      } catch (error) {
        console.error("[Admin] Failed to get escalation tickets:", error);
        throw error;
      }
    }),

  /**
   * Update escalation ticket status
   */
  updateEscalationStatus: adminProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
        status: z.enum(["pending", "in_progress", "resolved", "closed"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db
          .update(escalationTickets)
          .set({ status: input.status, resolvedAt: input.status === "resolved" ? new Date() : null })
          .where(eq(escalationTickets.id, input.ticketId));

        await supportService.logAudit(
          ctx.user.id,
          "UPDATE_ESCALATION_STATUS",
          "escalationTicket",
          input.ticketId,
          { status: input.status },
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        return { success: true };
      } catch (error) {
        console.error("[Admin] Failed to update escalation status:", error);
        throw error;
      }
    }),

  /**
   * Get audit logs
   */
  getAuditLogs: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        userId: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        let query = db.select().from(auditLogs);

        if (input.action) {
          query = query.where(eq(auditLogs.action, input.action)) as any;
        }

        if (input.userId) {
          query = query.where(eq(auditLogs.userId, input.userId)) as any;
        }

        return await query.orderBy(auditLogs.createdAt).limit(input.limit).offset(input.offset);
      } catch (error) {
        console.error("[Admin] Failed to get audit logs:", error);
        throw error;
      }
    }),

  /**
   * Trigger pattern detection for a department
   */
  detectPatterns: adminProcedure
    .input(z.object({ departmentId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await supportService.detectPatterns(input.departmentId);

        await supportService.logAudit(
          ctx.user.id,
          "DETECT_PATTERNS",
          "department",
          input.departmentId,
          {},
          ctx.req.ip,
          ctx.req.get("user-agent")
        );

        return { success: true };
      } catch (error) {
        console.error("[Admin] Failed to detect patterns:", error);
        throw error;
      }
    }),

  /**
   * Get system statistics
   */
  getStatistics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    try {
      const stats = {
        totalConversations: 0,
        totalMessages: 0,
        openConversations: 0,
        escalatedConversations: 0,
        closedConversations: 0,
      };

      // In production, implement actual statistics queries
      return stats;
    } catch (error) {
      console.error("[Admin] Failed to get statistics:", error);
      throw error;
    }
  }),
});

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { escalationTickets, messages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const agentDashboardRouter = router({
  // Get all escalations assigned to the current agent
  getMyEscalations: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "resolved"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [
        eq(escalationTickets.workspaceId, ctx.workspace!.id),
        eq(escalationTickets.assignedTo, ctx.user.id),
      ];

      if (input.status) {
        conditions.push(eq(escalationTickets.status, input.status));
      }

      if (input.priority) {
        conditions.push(eq(escalationTickets.priority, input.priority));
      }

      return await db
        .select()
        .from(escalationTickets)
        .where(and(...conditions));
    }),

  // Get escalation details with conversation history
  getEscalationDetails: protectedProcedure
    .input(z.object({ escalationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const escalation = await db
        .select()
        .from(escalationTickets)
        .where(
          and(
            eq(escalationTickets.id, input.escalationId),
            eq(escalationTickets.workspaceId, ctx.workspace!.id),
            eq(escalationTickets.assignedTo, ctx.user.id)
          )
        )
        .limit(1);

      if (!escalation.length) {
        throw new Error("Escalation not found or not assigned to you");
      }

      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, escalation[0].conversationId))
        .orderBy(messages.createdAt);

      return {
        escalation: escalation[0],
        messages: conversationMessages,
      };
    }),

  // Update escalation status
  updateEscalationStatus: protectedProcedure
    .input(
      z.object({
        escalationId: z.number(),
        status: z.enum(["pending", "in_progress", "resolved"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const escalation = await db
        .select()
        .from(escalationTickets)
        .where(
          and(
            eq(escalationTickets.id, input.escalationId),
            eq(escalationTickets.workspaceId, ctx.workspace!.id),
            eq(escalationTickets.assignedTo, ctx.user.id)
          )
        )
        .limit(1);

      if (!escalation.length) {
        throw new Error("Escalation not found or not assigned to you");
      }

      await db
        .update(escalationTickets)
        .set({
          status: input.status,

        })
        .where(eq(escalationTickets.id, input.escalationId));

      return { success: true };
    }),

  // Accept an escalation (assign to self if unassigned)
  acceptEscalation: protectedProcedure
    .input(z.object({ escalationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

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

      if (!escalation.length) {
        throw new Error("Escalation not found");
      }

      await db
        .update(escalationTickets)
        .set({
          assignedTo: ctx.user.id,
          status: "in_progress",

        })
        .where(eq(escalationTickets.id, input.escalationId));

      return { success: true };
    }),

  // Transfer escalation to another agent
  transferEscalation: protectedProcedure
    .input(
      z.object({
        escalationId: z.number(),
        targetAgentId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const escalation = await db
        .select()
        .from(escalationTickets)
        .where(
          and(
            eq(escalationTickets.id, input.escalationId),
            eq(escalationTickets.workspaceId, ctx.workspace!.id),
            eq(escalationTickets.assignedTo, ctx.user.id)
          )
        )
        .limit(1);

      if (!escalation.length) {
        throw new Error("Escalation not found or not assigned to you");
      }

      await db
        .update(escalationTickets)
        .set({
          assignedTo: input.targetAgentId,
          status: "pending",

        })
        .where(eq(escalationTickets.id, input.escalationId));

      return { success: true };
    }),

  // Get available agents for transfer
  getAvailableAgents: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // This would typically query from a user/agent table
    // For now, returning a placeholder
    return [];
  }),

  // Get agent statistics
  getAgentStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const escalations = await db
      .select()
      .from(escalationTickets)
      .where(
        and(
          eq(escalationTickets.workspaceId, ctx.workspace!.id),
          eq(escalationTickets.assignedTo, ctx.user.id)
        )
      );

    const pending = escalations.filter((e) => e.status === "pending").length;
    const inProgress = escalations.filter(
      (e) => e.status === "in_progress"
    ).length;
    const resolved = escalations.filter((e) => e.status === "resolved").length;

    return {
      totalEscalations: escalations.length,
      pending,
      inProgress,
      resolved,
      avgResolutionTime: 0, // Calculate from timestamps
    };
  }),
});

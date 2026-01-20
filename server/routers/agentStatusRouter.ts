import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workspaceMembers, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Agent status router - handles agent availability and status management
 * Allows agents to set their availability (online/busy/offline)
 */
export const agentStatusRouter = router({
  /**
   * Update agent availability status
   * Only agents can update their own status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        status: z.enum(["online", "busy", "offline"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user is an agent in this workspace
      const membership = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, ctx.workspace!.id),
            eq(workspaceMembers.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!membership.length || (membership[0].role !== "agent" && membership[0].role !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only agents can update their status",
        });
      }

      // TODO: Store agent status in a new agent_status table
      // For now, return success response
      // In production, this would:
      // 1. Create an agent_status table with (userId, workspaceId, status, lastUpdated)
      // 2. Update the status in the table
      // 3. Broadcast status change via WebSocket

      return {
        success: true,
        status: input.status,
        updatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Get agent's current status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // TODO: Query agent_status table
    // For now, return default status
    return {
      userId: ctx.user.id,
      status: "offline" as const,
      lastUpdated: new Date().toISOString(),
    };
  }),

  /**
   * Get all agents' availability in workspace
   */
  getWorkspaceAgentStatuses: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all agents in workspace
    const agents = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, ctx.workspace!.id),
          eq(workspaceMembers.role, "agent")
        )
      );

    // TODO: Join with agent_status table to get current statuses
    // For now, return agents with default offline status
    const agentStatuses = agents.map((agent) => ({
      userId: agent.userId,
      status: "offline" as const,
      lastUpdated: new Date().toISOString(),
    }));

    return agentStatuses;
  }),

  /**
   * Get available agents (online or busy)
   */
  getAvailableAgents: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all agents in workspace
    const agents = await db
      .select()
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, ctx.workspace!.id),
          eq(workspaceMembers.role, "agent")
        )
      );

    // TODO: Filter by status (online or busy)
    // For now, return all agents
    const availableAgents = agents.map((agent) => ({
      id: agent.users.id,
      name: agent.users.name,
      email: agent.users.email,
      status: "offline" as const,
    }));

    return availableAgents;
  }),

  /**
   * Get online agents count
   */
  getOnlineAgentCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // TODO: Query agent_status table and count online agents
    // For now, return 0
    return {
      total: 0,
      online: 0,
      busy: 0,
      offline: 0,
    };
  }),

  /**
   * Set automatic status change after inactivity
   */
  setAutoStatusChange: protectedProcedure
    .input(
      z.object({
        inactivityMinutes: z.number().int().positive(),
        autoChangeStatus: z.enum(["busy", "offline"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Store auto-status settings in user preferences
      // When user is inactive for specified minutes, automatically change status

      return {
        success: true,
        inactivityMinutes: input.inactivityMinutes,
        autoChangeStatus: input.autoChangeStatus,
      };
    }),

  /**
   * Get agent status history
   */
  getStatusHistory: protectedProcedure
    .input(
      z.object({
        days: z.number().int().positive().default(7),
        limit: z.number().int().positive().default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO: Query agent_status_history table
      // Return status changes over the specified period

      return [] as any[];
    }),

  /**
   * Bulk update agent statuses (admin only)
   */
  bulkUpdateStatuses: protectedProcedure
    .input(
      z.object({
        agentIds: z.array(z.number().int().positive()),
        status: z.enum(["online", "busy", "offline"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user is admin in workspace
      const membership = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, ctx.workspace!.id),
            eq(workspaceMembers.userId, ctx.user.id),
            eq(workspaceMembers.role, "admin")
          )
        )
        .limit(1);

      if (!membership.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can bulk update agent statuses",
        });
      }

      // TODO: Update statuses for all specified agents
      return {
        success: true,
        updatedCount: input.agentIds.length,
        status: input.status,
      };
    }),
});

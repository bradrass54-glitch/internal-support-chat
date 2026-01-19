import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workspaces, departments, escalationRules } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";

export const workspaceSettingsRouter = router({
  // Get workspace settings
  getWorkspaceSettings: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspace?.id || 0))
      .limit(1);

    if (!workspace.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
    }

    return workspace[0];
  }),

  // Update workspace branding
  updateBranding: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        logo: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(workspaces)
        .set({
          name: input.name,
          description: input.description,
          logo: input.logo,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, ctx.workspace?.id || 0));

      return { success: true };
    }),

  // Upload workspace logo
  uploadLogo: adminProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      if (!ctx.workspace) throw new TRPCError({ code: "UNAUTHORIZED", message: "No workspace context" });

      const fileKey = `workspaces/${ctx.workspace.id}/logo-${Date.now()}-${input.fileName}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(workspaces)
        .set({ logo: url, updatedAt: new Date() })
        .where(eq(workspaces.id, ctx.workspace?.id || 0));

      return { url };
    }),

  // Get all departments
  getDepartments: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    if (!ctx.workspace) throw new TRPCError({ code: "UNAUTHORIZED", message: "No workspace context" });

    return await db
      .select()
      .from(departments)
      .where(eq(departments.workspaceId, ctx.workspace.id));
  }),

  // Create department
  createDepartment: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!ctx.workspace) throw new TRPCError({ code: "UNAUTHORIZED", message: "No workspace context" });

      const result = await db.insert(departments).values({
        workspaceId: ctx.workspace.id,
        name: input.name,
        description: input.description,
      });

      return { id: result[0].insertId, ...input };
    }),

  // Update department
  updateDepartment: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(departments)
        .set({
          name: input.name,
          description: input.description,
        })
        .where(and(eq(departments.id, input.id), eq(departments.workspaceId, ctx.workspace?.id || 0)));

      return { success: true };
    }),

  // Delete department
  deleteDepartment: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .delete(departments)
        .where(and(eq(departments.id, input.id), eq(departments.workspaceId, ctx.workspace?.id || 0)));

      return { success: true };
    }),

  // Get escalation rules
  getEscalationRules: adminProcedure
    .input(z.object({ departmentId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!ctx.workspace) throw new TRPCError({ code: "UNAUTHORIZED", message: "No workspace context" });

      const conditions = [eq(escalationRules.workspaceId, ctx.workspace.id)];
      if (input.departmentId) {
        conditions.push(eq(escalationRules.departmentId, input.departmentId));
      }

      return await db
        .select()
        .from(escalationRules)
        .where(and(...conditions));
    }),

  // Create escalation rule
  createEscalationRule: adminProcedure
    .input(
      z.object({
        departmentId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        triggerType: z.enum(["time_elapsed", "keyword_match", "user_request", "ai_confidence"]),
        triggerValue: z.string().max(500),
        assignToDepartment: z.number().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!ctx.workspace) throw new TRPCError({ code: "UNAUTHORIZED", message: "No workspace context" });

      const result = await db.insert(escalationRules).values({
        workspaceId: ctx.workspace.id,
        departmentId: input.departmentId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerValue: input.triggerValue,
        assignToDepartment: input.assignToDepartment,
        priority: input.priority,
      });

      return { id: result[0].insertId, ...input };
    }),

  // Update escalation rule
  updateEscalationRule: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        triggerType: z.enum(["time_elapsed", "keyword_match", "user_request", "ai_confidence"]),
        triggerValue: z.string().max(500),
        assignToDepartment: z.number().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(escalationRules)
        .set({
          name: input.name,
          description: input.description,
          triggerType: input.triggerType,
          triggerValue: input.triggerValue,
          assignToDepartment: input.assignToDepartment,
          priority: input.priority,
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(and(eq(escalationRules.id, input.id), eq(escalationRules.workspaceId, ctx.workspace?.id || 0)));

      return { success: true };
    }),

  // Delete escalation rule
  deleteEscalationRule: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .delete(escalationRules)
        .where(and(eq(escalationRules.id, input.id), eq(escalationRules.workspaceId, ctx.workspace?.id || 0)));

      return { success: true };
    }),
});

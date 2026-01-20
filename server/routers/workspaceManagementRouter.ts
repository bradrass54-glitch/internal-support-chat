import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { users, workspaces, workspaceMembers, invitations } from "../../drizzle/schema";

/**
 * Workspace management router - handles team members, invitations, and workspace settings
 * Protected to admin users only
 */
export const workspaceManagementRouter = router({
  /**
   * Get all team members in workspace
   */
  getTeamMembers: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const members = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: workspaceMembers.role,
            joinedAt: workspaceMembers.joinedAt,
          })
          .from(workspaceMembers)
          .innerJoin(users, eq(workspaceMembers.userId, users.id))
          .where(eq(workspaceMembers.workspaceId, ctx.workspace!.id))
          .limit(input.limit)
          .offset(input.offset);

        return members.map((m) => ({
          ...m,
          joinedAt: new Date(m.joinedAt),
        }));
      } catch (error) {
        console.error("Error fetching team members:", error);
        throw new Error("Failed to fetch team members");
      }
    }),

  /**
   * Update user role in workspace
   */
  updateUserRole: protectedProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(["owner", "admin", "agent", "user"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // Verify user is in same workspace
        const member = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.userId, input.userId),
              eq(workspaceMembers.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!member || member.length === 0) {
          throw new Error("User not found in workspace");
        }

        // Update role
        await db
          .update(workspaceMembers)
          .set({ role: input.role as any })
          .where(
            and(
              eq(workspaceMembers.userId, input.userId),
              eq(workspaceMembers.workspaceId, ctx.workspace!.id)
            )
          );

        return { success: true, message: `User role updated to ${input.role}` };
      } catch (error) {
        console.error("Error updating user role:", error);
        throw new Error("Failed to update user role");
      }
    }),

  /**
   * Remove user from workspace
   */
  removeTeamMember: protectedProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      if (input.userId === ctx.user.id) {
        throw new Error("Cannot remove yourself from workspace");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // Verify user is in same workspace
        const member = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.userId, input.userId),
              eq(workspaceMembers.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!member || member.length === 0) {
          throw new Error("User not found in workspace");
        }

        // Delete workspace membership
        await db
          .delete(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.userId, input.userId),
              eq(workspaceMembers.workspaceId, ctx.workspace!.id)
            )
          );

        return { success: true, message: "User removed from workspace" };
      } catch (error) {
        console.error("Error removing team member:", error);
        throw new Error("Failed to remove team member");
      }
    }),

  /**
   * Get pending invitations
   */
  getPendingInvitations: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const pendingInvites = await db
          .select({
            id: invitations.id,
            email: invitations.email,
            role: invitations.role,
            status: invitations.status,
            createdAt: invitations.createdAt,
            expiresAt: invitations.expiresAt,
          })
          .from(invitations)
          .where(
            and(
              eq(invitations.workspaceId, ctx.workspace!.id),
              eq(invitations.status, "pending" as any)
            )
          )
          .limit(input.limit)
          .offset(input.offset);

        return pendingInvites.map((inv) => ({
          ...inv,
          createdAt: new Date(inv.createdAt),
          expiresAt: new Date(inv.expiresAt),
        }));
      } catch (error) {
        console.error("Error fetching pending invitations:", error);
        throw new Error("Failed to fetch pending invitations");
      }
    }),

  /**
   * Send invitation to new team member
   */
  sendInvitation: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["owner", "admin", "agent", "user"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        // Check if user already exists in workspace
        const existingMember = await db
          .select()
          .from(workspaceMembers)
          .innerJoin(users, eq(workspaceMembers.userId, users.id))
          .where(
            and(
              eq(users.email, input.email),
              eq(workspaceMembers.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (existingMember && existingMember.length > 0) {
          throw new Error("User already exists in workspace");
        }

        // Check if invitation already exists
        const existingInvite = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.email, input.email),
              eq(invitations.workspaceId, ctx.workspace!.id),
              eq(invitations.status, "pending" as any)
            )
          )
          .limit(1);

        if (existingInvite && existingInvite.length > 0) {
          throw new Error("Invitation already sent to this email");
        }

        // Generate invitation token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Create invitation
        const result = await db.insert(invitations).values({
          workspaceId: ctx.workspace!.id,
          email: input.email,
          role: input.role as any,
          token,
          status: "pending" as any,
          expiresAt,
          createdAt: new Date(),
        });

        // TODO: Send email with invitation link
        // const inviteUrl = `${process.env.FRONTEND_URL}/join?token=${token}`;
        // await sendInvitationEmail(input.email, inviteUrl, ctx.workspace!.name);

        return {
          success: true,
          message: `Invitation sent to ${input.email}`,
          invitationId: result[0].insertId,
        };
      } catch (error) {
        console.error("Error sending invitation:", error);
        throw new Error("Failed to send invitation");
      }
    }),

  /**
   * Resend invitation
   */
  resendInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const invitation = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.id, input.invitationId),
              eq(invitations.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!invitation || invitation.length === 0) {
          throw new Error("Invitation not found");
        }

        // Update expiration date
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db
          .update(invitations)
          .set({ expiresAt: newExpiresAt })
          .where(eq(invitations.id, input.invitationId));

        // TODO: Resend email

        return { success: true, message: "Invitation resent" };
      } catch (error) {
        console.error("Error resending invitation:", error);
        throw new Error("Failed to resend invitation");
      }
    }),

  /**
   * Cancel invitation
   */
  cancelInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const invitation = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.id, input.invitationId),
              eq(invitations.workspaceId, ctx.workspace!.id)
            )
          )
          .limit(1);

        if (!invitation || invitation.length === 0) {
          throw new Error("Invitation not found");
        }

        // Update status to cancelled
        await db
          .update(invitations)
          .set({ status: "cancelled" as any })
          .where(eq(invitations.id, input.invitationId));

        return { success: true, message: "Invitation cancelled" };
      } catch (error) {
        console.error("Error cancelling invitation:", error);
        throw new Error("Failed to cancel invitation");
      }
    }),

  /**
   * Get workspace details
   */
  getWorkspaceDetails: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const workspace = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, input.workspaceId || ctx.workspace!.id))
          .limit(1);

        if (!workspace || workspace.length === 0) {
          throw new Error("Workspace not found");
        }

        return {
          id: workspace[0].id,
          name: workspace[0].name,
          description: workspace[0].description,
          logo: workspace[0].logo,
          slug: workspace[0].slug,
          createdAt: new Date(workspace[0].createdAt),
          updatedAt: new Date(workspace[0].updatedAt),
        };
      } catch (error) {
        console.error("Error fetching workspace details:", error);
        throw new Error("Failed to fetch workspace details");
      }
    }),

  /**
   * Update workspace details
   */
  updateWorkspaceDetails: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        logo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const updates: any = {};
        if (input.name) updates.name = input.name;
        if (input.description) updates.description = input.description;
        if (input.logo) updates.logo = input.logo;
        updates.updatedAt = new Date();

        await db
          .update(workspaces)
          .set(updates)
          .where(eq(workspaces.id, ctx.workspace!.id));

        return { success: true, message: "Workspace updated successfully" };
      } catch (error) {
        console.error("Error updating workspace:", error);
        throw new Error("Failed to update workspace");
      }
    }),

  /**
   * Get workspace statistics
   */
  getWorkspaceStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      // Count team members
      const memberCount = await db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, ctx.workspace!.id));

      // Count pending invitations
      const pendingInvites = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.workspaceId, ctx.workspace!.id),
            eq(invitations.status, "pending" as any)
          )
        );

      // Count by role
      const owners = memberCount.filter((m) => m.role === "owner").length;
      const admins = memberCount.filter((m) => m.role === "admin").length;
      const agents = memberCount.filter((m) => m.role === "agent").length;
      const regularUsers = memberCount.filter((m) => m.role === "user").length;

      return {
        totalMembers: memberCount.length,
        owners,
        admins,
        agents,
        regularUsers,
        pendingInvitations: pendingInvites.length,
      };
    } catch (error) {
      console.error("Error fetching workspace stats:", error);
      throw new Error("Failed to fetch workspace statistics");
    }
  }),
});

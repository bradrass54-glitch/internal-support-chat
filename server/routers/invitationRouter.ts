import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workspaceMembers, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Invitation router - handles email-based team member invitations
 * Allows admins to invite users with pre-assigned roles
 */
export const invitationRouter = router({
  /**
   * Send invitation to a new team member
   * Only workspace admins can send invitations
   */
  sendInvitation: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["admin", "agent", "user"]),
        message: z.string().optional(),
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
          message: "Only workspace admins can send invitations",
        });
      }

      // Check if user already exists in workspace
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        const existingMember = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, ctx.workspace!.id),
              eq(workspaceMembers.userId, existingUser[0].id)
            )
          )
          .limit(1);

        if (existingMember.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User is already a member of this workspace",
          });
        }
      }

      // TODO: Send invitation email with unique token
      // For now, we'll return a placeholder response
      // In production, this would:
      // 1. Generate a unique invitation token
      // 2. Store token in database with expiration
      // 3. Send email with invitation link
      // 4. Link would be: https://workspace.example.com/invite?token=XXX

      return {
        success: true,
        message: `Invitation sent to ${input.email}`,
        invitationId: Math.random().toString(36).substr(2, 9),
      };
    }),

  /**
   * Get pending invitations for workspace
   */
  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if user is admin
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
        message: "Only workspace admins can view invitations",
      });
    }

    // TODO: Query pending invitations from database
    // For now, return empty array
    return [];
  }),

  /**
   * Resend invitation to a user
   */
  resendInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user is admin
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
          message: "Only workspace admins can resend invitations",
        });
      }

      // TODO: Resend invitation email
      return { success: true };
    }),

  /**
   * Cancel an invitation
   */
  cancelInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user is admin
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
          message: "Only workspace admins can cancel invitations",
        });
      }

      // TODO: Delete invitation from database
      return { success: true };
    }),

  /**
   * Accept an invitation (called by invited user)
   */
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // TODO: Verify token and add user to workspace
      // 1. Look up invitation token in database
      // 2. Check if token is still valid (not expired)
      // 3. Add user to workspace with pre-assigned role
      // 4. Mark invitation as accepted
      // 5. Delete token

      return { success: true };
    }),

  /**
   * Decline an invitation (called by invited user)
   */
  declineInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // TODO: Verify token and decline invitation
      // 1. Look up invitation token
      // 2. Mark as declined
      // 3. Delete token

      return { success: true };
    }),
});

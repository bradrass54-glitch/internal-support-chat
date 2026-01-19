import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workspaces, departments, workspaceMembers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "../storage";

export const setupRouter = router({
  /**
   * Check if workspace needs setup
   */
  checkSetupStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.workspace) return { needsSetup: true };

    try {
      // Check if workspace has been configured
      const workspace = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, ctx.workspace.id))
        .limit(1);

      if (!workspace[0]) return { needsSetup: true };

      // Check if workspace has departments
      const deptCount = await db
        .select()
        .from(departments)
        .where(eq(departments.workspaceId, ctx.workspace.id));

      return {
        needsSetup: deptCount.length === 0,
        workspace: workspace[0],
        departmentCount: deptCount.length,
      };
    } catch (error) {
      console.error("[Setup] Failed to check setup status:", error);
      return { needsSetup: true };
    }
  }),

  /**
   * Complete workspace setup
   */
  completeSetup: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        logo: z.string().optional(), // Base64 encoded image or URL
        departments: z.array(
          z.object({
            name: z.string().min(1).max(255),
            description: z.string().max(500).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db || !ctx.workspace) {
        throw new Error("Workspace not found");
      }

      try {
        let logoUrl: string | null = null;

        // Upload logo if provided
        if (input.logo) {
          try {
            // Check if it's a base64 string or URL
            if (input.logo.startsWith("data:")) {
              // Convert base64 to buffer
              const matches = input.logo.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, "base64");

                // Upload to S3
                const fileKey = `workspaces/${ctx.workspace.id}/logo-${Date.now()}`;
                const { url } = await storagePut(fileKey, buffer, mimeType);
                logoUrl = url;
              }
            } else if (input.logo.startsWith("http")) {
              // Use URL directly
              logoUrl = input.logo;
            }
          } catch (error) {
            console.error("[Setup] Failed to upload logo:", error);
            // Continue without logo
          }
        }

        // Update workspace
        await db
          .update(workspaces)
          .set({
            name: input.name,
            description: input.description,
            logo: logoUrl,
          })
          .where(eq(workspaces.id, ctx.workspace.id));

        // Create departments
        for (const dept of input.departments) {
          await db.insert(departments).values({
            workspaceId: ctx.workspace.id,
            name: dept.name,
            description: dept.description,
          });
        }

        // Add current user as workspace member with admin role
        const existingMember = await db
          .select()
          .from(workspaceMembers)
          .where(
            eq(workspaceMembers.workspaceId, ctx.workspace.id) &&
              eq(workspaceMembers.userId, ctx.user.id)
          );

        if (existingMember.length === 0) {
          await db.insert(workspaceMembers).values({
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            role: "admin",
          });
        }

        return {
          success: true,
          workspace: {
            id: ctx.workspace.id,
            name: input.name,
            logo: logoUrl,
          },
        };
      } catch (error) {
        console.error("[Setup] Failed to complete setup:", error);
        throw error;
      }
    }),

  /**
   * Get available department templates
   */
  getDepartmentTemplates: protectedProcedure.query(async () => {
    return [
      {
        name: "IT Support",
        description: "Technical support and IT infrastructure assistance",
      },
      {
        name: "Human Resources",
        description: "HR policies, benefits, and employee services",
      },
      {
        name: "Finance",
        description: "Financial services, expense reports, and billing",
      },
      {
        name: "Sales",
        description: "Sales inquiries and customer support",
      },
      {
        name: "Operations",
        description: "Operations and process support",
      },
    ];
  }),
});

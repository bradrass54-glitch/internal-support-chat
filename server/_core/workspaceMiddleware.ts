import { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { workspaces } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

/**
 * Extract workspace from subdomain or custom domain
 * Examples:
 * - acme.localhost:3000 -> workspace slug: "acme"
 * - acme.example.com -> workspace slug: "acme"
 * - w4efyq57cl-gnma6n3fbq-uk.a.run.app -> workspace slug: "w4efyq57cl-gnma6n3fbq-uk"
 * - custom.domain.com -> lookup by customDomain
 */
export function extractWorkspaceSlug(host: string): string | null {
  if (!host) return null;

  // Remove port if present
  const hostWithoutPort = host.split(":")[0];

  // Check if this is a full domain (not localhost or root domain)
  // For domains like w4efyq57cl-gnma6n3fbq-uk.a.run.app, use everything before the first dot
  const parts = hostWithoutPort.split(".");

  // If we have at least 2 parts and the first part is not "www"
  if (parts.length >= 2 && parts[0] !== "www") {
    return parts[0].toLowerCase();
  }

  // If only one part (localhost), return null
  return null;
}

/**
 * Create default workspace for new domain
 */
export async function createDefaultWorkspace(slug: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(workspaces).values({
      slug: slug.toLowerCase(),
      name: `${slug} Workspace`,
      ownerId: 1,
    });

    const workspaceId = (result as any).insertId as number;
    const created = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Workspace] Failed to create default workspace:", error);
    return null;
  }
}

/**
 * Resolve workspace from slug or custom domain
 * Auto-creates workspace if it doesn't exist
 */
export async function resolveWorkspace(host: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const slug = extractWorkspaceSlug(host);

    // Try to find workspace by slug or custom domain
    const result = await db
      .select()
      .from(workspaces)
      .where(
        or(
          slug ? eq(workspaces.slug, slug) : undefined,
          eq(workspaces.customDomain, host)
        )
      )
      .limit(1);

    if (result.length > 0) {
      return result[0];
    }

    // If workspace not found and we have a slug, auto-create it
    if (slug) {
      console.log(`[Workspace] Auto-creating workspace for slug: ${slug}`);
      return await createDefaultWorkspace(slug);
    }

    return null;
  } catch (error) {
    console.error("[Workspace] Resolution failed:", error);
    return null;
  }
}

/**
 * Middleware to attach workspace to request context
 */
export async function workspaceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const host = req.get("host") || "";
    const workspace = await resolveWorkspace(host);

    // Attach workspace to request
    (req as any).workspace = workspace;

    // If no workspace found and we tried to create one, check again
    if (!workspace && extractWorkspaceSlug(host)) {
      console.warn(`[Workspace Middleware] Failed to resolve workspace for domain: ${host}`);
      return res.status(500).json({
        error: "Workspace initialization failed",
        message: `Could not initialize workspace for domain: ${host}`,
      });
    }

    next();
  } catch (error) {
    console.error("[Workspace Middleware] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get workspace from request
 */
export function getRequestWorkspace(req: any) {
  return req.workspace || null;
}

/**
 * Get workspace ID from request
 */
export function getWorkspaceId(req: any): number | null {
  return req.workspace?.id || null;
}

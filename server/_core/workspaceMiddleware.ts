import { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { workspaces } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

/**
 * Extract workspace from subdomain or custom domain
 * Examples:
 * - acme.localhost:3000 -> workspace slug: "acme"
 * - acme.example.com -> workspace slug: "acme"
 * - custom.domain.com -> lookup by customDomain
 */
export function extractWorkspaceSlug(host: string): string | null {
  if (!host) return null;

  // Remove port if present
  const hostWithoutPort = host.split(":")[0];

  // Get the first part of the domain (subdomain)
  const parts = hostWithoutPort.split(".");

  // If we have at least 2 parts and the first part is not "www"
  if (parts.length >= 2 && parts[0] !== "www") {
    return parts[0].toLowerCase();
  }

  return null;
}

/**
 * Resolve workspace from slug or custom domain
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

    return result.length > 0 ? result[0] : null;
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

    // If no workspace found and not on root domain, return 404
    if (!workspace && extractWorkspaceSlug(host)) {
      return res.status(404).json({
        error: "Workspace not found",
        message: `No workspace found for domain: ${host}`,
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

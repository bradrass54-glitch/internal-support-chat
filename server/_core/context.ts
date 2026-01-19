import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User, Workspace } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getRequestWorkspace } from "./workspaceMiddleware";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  workspace: Workspace | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const workspace = getRequestWorkspace(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
    workspace,
  };
}

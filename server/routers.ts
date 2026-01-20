import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { supportRouter } from "./routers/supportRouter";
import { adminRouter } from "./routers/adminRouter";
import { agentRouter } from "./routers/agentRouter";
import { knowledgeBaseRouter } from "./routers/knowledgeBaseRouter";
import { setupRouter } from "./routers/setupRouter";
import { workspaceSettingsRouter } from "./routers/workspaceSettingsRouter";
import { userManagementRouter } from "./routers/userManagementRouter";
import { agentDashboardRouter } from "./routers/agentDashboardRouter";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Support chat system router
  support: supportRouter,
  // Admin operations router
  admin: adminRouter,
  // Agent operations router
  agent: agentRouter,
  // Knowledge base router
  knowledgeBase: knowledgeBaseRouter,
  // Setup wizard router
  setup: setupRouter,
  // Workspace settings router
  workspaceSettings: workspaceSettingsRouter,
  // User management router
  users: userManagementRouter,
  // Agent dashboard router
  agentDashboard: agentDashboardRouter,
});

export type AppRouter = typeof appRouter;

import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supportRouter } from "./routers/supportRouter";
import { adminRouter } from "./routers/adminRouter";
import { agentRouter } from "./routers/agentRouter";
import { knowledgeBaseRouter } from "./routers/knowledgeBaseRouter";
import { getDb } from "./db";
import { workspaceMembers } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { setupRouter } from "./routers/setupRouter";
import { workspaceSettingsRouter } from "./routers/workspaceSettingsRouter";
import { userManagementRouter } from "./routers/userManagementRouter";
import { agentDashboardRouter } from "./routers/agentDashboardRouter";
import { invitationRouter } from "./routers/invitationRouter";
import { conversationSearchRouter } from "./routers/conversationSearchRouter";
import { feedbackRouter } from "./routers/feedbackRouter";
import { agentStatusRouter } from "./routers/agentStatusRouter";
import { notificationRouter } from "./routers/notificationRouter";
import { adminConversationRouter } from "./routers/adminConversationRouter";

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
  // Invitation router
  invitations: invitationRouter,
  // Conversation search router
  conversationSearch: conversationSearchRouter,
  // Feedback router
  feedback: feedbackRouter,
  // Agent status router
  agentStatus: agentStatusRouter,
  // Notification router
  notifications: notificationRouter,
  // Admin conversation router
  adminConversations: adminConversationRouter,
});

export type AppRouter = typeof appRouter;

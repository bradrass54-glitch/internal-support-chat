import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Workspaces table for multi-tenant support
 * Each company/organization gets their own workspace
 */
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 63 }).notNull().unique(), // subdomain slug (e.g., "acme")
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: int("ownerId").notNull(), // user who created the workspace
  logo: varchar("logo", { length: 500 }), // URL to workspace logo
  customDomain: varchar("customDomain", { length: 255 }), // optional custom domain
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

/**
 * Workspace members - links users to workspaces
 */
export const workspaceMembers = mysqlTable("workspaceMembers", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "agent", "user"]).default("user").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;

/**
 * Department enum for routing support requests
 */
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(), // workspace this department belongs to
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

/**
 * Extended user roles for support system
 */
export const userDepartments = mysqlTable("userDepartments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  departmentId: int("departmentId").notNull(),
  role: mysqlEnum("role", ["user", "agent", "manager"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userDeptIdx: index("userDeptIdx").on(table.userId, table.departmentId),
}));

export type UserDepartment = typeof userDepartments.$inferSelect;
export type InsertUserDepartment = typeof userDepartments.$inferInsert;

/**
 * Conversations table - stores chat sessions
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(), // workspace this conversation belongs to
  userId: int("userId").notNull(),
  departmentId: int("departmentId").notNull(),
  title: varchar("title", { length: 255 }),
  status: mysqlEnum("status", ["open", "escalated", "closed", "pending"]).default("open").notNull(),
  escalatedTo: int("escalatedTo"), // Agent ID
  escalationReason: text("escalationReason"),
  summary: text("summary"), // AI-generated summary
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  closedAt: timestamp("closedAt"),
}, (table) => ({
  userIdx: index("userIdx").on(table.userId),
  deptIdx: index("deptIdx").on(table.departmentId),
  statusIdx: index("statusIdx").on(table.status),
}));

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table - stores individual messages in conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  senderType: mysqlEnum("senderType", ["user", "agent", "system"]).default("user").notNull(),
  content: text("content").notNull(),
  contentHash: varchar("contentHash", { length: 64 }), // For pattern detection
  isAIGenerated: boolean("isAIGenerated").default(false).notNull(),
  metadata: json("metadata"), // Store sentiment, intent, entities
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  convIdx: index("convIdx").on(table.conversationId),
  senderIdx: index("senderIdx").on(table.senderId),
  createdIdx: index("createdIdx").on(table.createdAt),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Pattern detection table - stores identified recurring issues
 */
export const patterns = mysqlTable("patterns", {
  id: int("id").autoincrement().primaryKey(),
  departmentId: int("departmentId").notNull(),
  patternHash: varchar("patternHash", { length: 64 }).notNull().unique(),
  description: text("description").notNull(),
  occurrenceCount: int("occurrenceCount").default(1).notNull(),
  suggestedSolution: text("suggestedSolution"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  lastOccurrence: timestamp("lastOccurrence"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  deptIdx: index("deptIdx").on(table.departmentId),
  hashIdx: index("hashIdx").on(table.patternHash),
}));

export type Pattern = typeof patterns.$inferSelect;
export type InsertPattern = typeof patterns.$inferInsert;

/**
 * Alerts table - proactive notifications about known issues
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  patternId: int("patternId").notNull(),
  departmentId: int("departmentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({
  deptIdx: index("deptIdx").on(table.departmentId),
  activeIdx: index("activeIdx").on(table.isActive),
}));

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Audit log table - tracks all sensitive operations for compliance
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resourceType", { length: 100 }),
  resourceId: int("resourceId"),
  changes: json("changes"), // Store before/after values
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("userIdx").on(table.userId),
  actionIdx: index("actionIdx").on(table.action),
  createdIdx: index("createdIdx").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Escalation tickets table - tracks escalations to live agents
 */
export const escalationTickets = mysqlTable("escalationTickets", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(), // workspace this ticket belongs to
  conversationId: int("conversationId").notNull(),
  assignedTo: int("assignedTo").notNull(), // Agent ID
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "resolved", "closed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
}, (table) => ({
  convIdx: index("convIdx").on(table.conversationId),
  agentIdx: index("agentIdx").on(table.assignedTo),
  statusIdx: index("statusIdx").on(table.status),
}));

export type EscalationTicket = typeof escalationTickets.$inferSelect;
export type InsertEscalationTicket = typeof escalationTickets.$inferInsert;

/**
 * Documentation sources table - stores AI training data
 */
export const documentationSources = mysqlTable("documentationSources", {
  id: int("id").autoincrement().primaryKey(),
  departmentId: int("departmentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  url: varchar("url", { length: 2048 }),
  category: varchar("category", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  deptIdx: index("deptIdx").on(table.departmentId),
  categoryIdx: index("categoryIdx").on(table.category),
}));

export type DocumentationSource = typeof documentationSources.$inferSelect;
export type InsertDocumentationSource = typeof documentationSources.$inferInsert;

/**
 * Learning interactions table - stores feedback for model improvement
 */
export const learningInteractions = mysqlTable("learningInteractions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  feedback: mysqlEnum("feedback", ["helpful", "not_helpful", "partially_helpful"]),
  rating: int("rating"), // 1-5 star rating
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  msgIdx: index("msgIdx").on(table.messageId),
  userIdx: index("userIdx").on(table.userId),
}));

export type LearningInteraction = typeof learningInteractions.$inferSelect;
export type InsertLearningInteraction = typeof learningInteractions.$inferInsert;

/**
 * Relations for foreign keys
 */
export const usersRelations = relations(users, ({ many }) => ({
  departments: many(userDepartments),
  conversations: many(conversations),
  messages: many(messages),
  auditLogs: many(auditLogs),
  learningInteractions: many(learningInteractions),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(userDepartments),
  conversations: many(conversations),
  patterns: many(patterns),
  alerts: many(alerts),
  documentation: many(documentationSources),
}));

export const userDepartmentsRelations = relations(userDepartments, ({ one }) => ({
  user: one(users, { fields: [userDepartments.userId], references: [users.id] }),
  department: one(departments, { fields: [userDepartments.departmentId], references: [departments.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  department: one(departments, { fields: [conversations.departmentId], references: [departments.id] }),
  messages: many(messages),
  escalation: one(escalationTickets),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  learningInteraction: one(learningInteractions),
}));

export const patternsRelations = relations(patterns, ({ one, many }) => ({
  department: one(departments, { fields: [patterns.departmentId], references: [departments.id] }),
  alerts: many(alerts),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  pattern: one(patterns, { fields: [alerts.patternId], references: [patterns.id] }),
  department: one(departments, { fields: [alerts.departmentId], references: [departments.id] }),
}));

export const escalationTicketsRelations = relations(escalationTickets, ({ one }) => ({
  conversation: one(conversations, { fields: [escalationTickets.conversationId], references: [conversations.id] }),
  assignedAgent: one(users, { fields: [escalationTickets.assignedTo], references: [users.id] }),
}));

export const documentationSourcesRelations = relations(documentationSources, ({ one }) => ({
  department: one(departments, { fields: [documentationSources.departmentId], references: [departments.id] }),
}));

export const learningInteractionsRelations = relations(learningInteractions, ({ one }) => ({
  message: one(messages, { fields: [learningInteractions.messageId], references: [messages.id] }),
  user: one(users, { fields: [learningInteractions.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));


/**
 * Knowledge base documents table - stores uploaded department-specific documents
 */
export const knowledgeBaseDocuments = mysqlTable("knowledgeBaseDocuments", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(), // workspace this document belongs to
  departmentId: int("departmentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: int("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  extractedText: text("extractedText"),
  status: mysqlEnum("status", ["uploading", "processing", "ready", "failed", "archived"]).default("uploading").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  version: int("version").default(1).notNull(),
  isPublic: boolean("isPublic").default(true).notNull(),
  tags: varchar("tags", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
}, (table) => ({
  deptIdx: index("kbDeptIdx").on(table.departmentId),
  statusIdx: index("kbStatusIdx").on(table.status),
  uploadedByIdx: index("kbUploadedByIdx").on(table.uploadedBy),
}));

export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type InsertKnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferInsert;

/**
 * Knowledge base chunks table - stores text chunks for semantic search
 */
export const knowledgeBaseChunks = mysqlTable("knowledgeBaseChunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  content: text("content").notNull(),
  embedding: varchar("embedding", { length: 4000 }),
  tokens: int("tokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  docIdx: index("kbChunkDocIdx").on(table.documentId),
}));

export type KnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferSelect;
export type InsertKnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferInsert;

export const knowledgeBaseDocumentsRelations = relations(knowledgeBaseDocuments, ({ one, many }) => ({
  department: one(departments, { fields: [knowledgeBaseDocuments.departmentId], references: [departments.id] }),
  uploadedByUser: one(users, { fields: [knowledgeBaseDocuments.uploadedBy], references: [users.id] }),
  chunks: many(knowledgeBaseChunks),
}));

export const knowledgeBaseChunksRelations = relations(knowledgeBaseChunks, ({ one }) => ({
  document: one(knowledgeBaseDocuments, { fields: [knowledgeBaseChunks.documentId], references: [knowledgeBaseDocuments.id] }),
}));

/**
 * Escalation rules table - defines escalation policies per workspace
 */
export const escalationRules = mysqlTable("escalationRules", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  departmentId: int("departmentId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: mysqlEnum("triggerType", ["time_elapsed", "keyword_match", "user_request", "ai_confidence"]).notNull(),
  triggerValue: varchar("triggerValue", { length: 500 }), // e.g., "5 minutes", "refund", "0.3"
  assignToDepartment: int("assignToDepartment"), // department to escalate to
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workspaceDeptIdx: index("workspaceDeptIdx").on(table.workspaceId, table.departmentId),
}));

export type EscalationRule = typeof escalationRules.$inferSelect;
export type InsertEscalationRule = typeof escalationRules.$inferInsert;


/**
 * Workspace invitations - for inviting new team members
 */
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["owner", "admin", "agent", "user"]).default("user").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "cancelled", "expired"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  conversations,
  messages,
  patterns,
  alerts,
  auditLogs,
  escalationTickets,
  departments,
  userDepartments,
  documentationSources,
  learningInteractions,
  type InsertConversation,
  type InsertMessage,
  type InsertPattern,
  type InsertAlert,
  type InsertAuditLog,
  type InsertEscalationTicket,
  type InsertDepartment,
  type InsertUserDepartment,
  type InsertDocumentationSource,
  type InsertLearningInteraction,
} from "../../drizzle/schema";

/**
 * Audit logging helper - logs all sensitive operations
 */
export async function logAudit(
  userId: number,
  action: string,
  resourceType?: string,
  resourceId?: number,
  changes?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("[Audit] Failed to log action:", error);
  }
}

/**
 * Create a new conversation
 */
export async function createConversation(
  workspaceId: number,
  userId: number,
  departmentId: number,
  title?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof conversations.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(conversations).values({
      workspaceId,
      userId,
      departmentId,
      title,
      status: "open",
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    await logAudit(userId, "CREATE_CONVERSATION", "conversation", Number(lastInsertId), { departmentId }, ipAddress, userAgent);

    const created = await db.select().from(conversations).where(eq(conversations.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to create conversation:", error);
    throw error;
  }
}

/**
 * Get conversation by ID with security check
 */
export async function getConversation(conversationId: number, userId: number): Promise<typeof conversations.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Support] Failed to get conversation:", error);
    throw error;
  }
}

/**
 * Get user's conversations
 */
export async function getUserConversations(userId: number, departmentId?: number, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [eq(conversations.userId, userId)];
    if (departmentId) {
      conditions.push(eq(conversations.departmentId, departmentId));
    }

    return await db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error("[Support] Failed to get user conversations:", error);
    throw error;
  }
}

/**
 * Add message to conversation
 */
export async function addMessage(
  conversationId: number,
  senderId: number,
  content: string,
  senderType: "user" | "agent" | "system" = "user",
  isAIGenerated: boolean = false,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof messages.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Hash content for pattern detection
    const contentHash = await hashContent(content);

    const result = await db.insert(messages).values({
      conversationId,
      senderId,
      senderType,
      content,
      contentHash,
      isAIGenerated,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    await logAudit(senderId, "ADD_MESSAGE", "message", Number(lastInsertId), { conversationId, isAIGenerated }, ipAddress, userAgent);

    const created = await db.select().from(messages).where(eq(messages.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to add message:", error);
    throw error;
  }
}

/**
 * Get conversation messages
 */
export async function getConversationMessages(conversationId: number, limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error("[Support] Failed to get messages:", error);
    throw error;
  }
}

/**
 * Escalate conversation to agent
 */
export async function escalateConversation(
  workspaceId: number,
  conversationId: number,
  agentId: number,
  reason: string,
  priority: "low" | "medium" | "high" | "urgent" = "medium",
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof escalationTickets.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Update conversation status
    await db.update(conversations).set({ status: "escalated", escalatedTo: agentId, escalationReason: reason }).where(eq(conversations.id, conversationId));

    // Create escalation ticket
    const result = await db.insert(escalationTickets).values({
      workspaceId,
      conversationId,
      assignedTo: agentId,
      priority,
      reason,
      status: "pending",
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    await logAudit(userId, "ESCALATE_CONVERSATION", "escalationTicket", Number(lastInsertId), { conversationId, agentId, priority }, ipAddress, userAgent);

    const created = await db.select().from(escalationTickets).where(eq(escalationTickets.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to escalate conversation:", error);
    throw error;
  }
}

/**
 * Detect patterns in messages - identifies recurring issues
 */
export async function detectPatterns(departmentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Get recent messages grouped by content hash
    const recentMessages = await db
      .select({
        contentHash: messages.contentHash,
        count: sql<number>`COUNT(*) as count`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.departmentId, departmentId), eq(conversations.status, "open")))
      .groupBy(messages.contentHash)
      .having(sql`COUNT(*) > 1`);

    for (const msgGroup of recentMessages) {
      if (!msgGroup.contentHash) continue;

      // Check if pattern already exists
      const existingPattern = await db
        .select()
        .from(patterns)
        .where(eq(patterns.patternHash, msgGroup.contentHash))
        .limit(1);

      if (existingPattern.length > 0) {
        // Update existing pattern
        await db
          .update(patterns)
          .set({
            occurrenceCount: msgGroup.count,
            lastOccurrence: new Date(),
            confidence: String(Math.min(1.0, msgGroup.count * 0.1)) as any, // Simple confidence calculation
          })
          .where(eq(patterns.id, existingPattern[0].id));
      } else {
        // Create new pattern
        const sampleMessage = await db
          .select({ content: messages.content })
          .from(messages)
          .where(eq(messages.contentHash, msgGroup.contentHash))
          .limit(1);

        if (sampleMessage.length > 0) {
          await db.insert(patterns).values({
            departmentId,
            patternHash: msgGroup.contentHash,
            description: `Recurring issue: ${sampleMessage[0].content.substring(0, 100)}...`,
            occurrenceCount: msgGroup.count,
            confidence: String(Math.min(1.0, msgGroup.count * 0.1)) as any,
            lastOccurrence: new Date(),
          });
        }
      }
    }
  } catch (error) {
    console.error("[Support] Failed to detect patterns:", error);
  }
}

/**
 * Create proactive alert for known pattern
 */
export async function createAlert(
  patternId: number,
  departmentId: number,
  title: string,
  message: string,
  severity: "low" | "medium" | "high" | "critical" = "medium",
  expiresAt?: Date,
  userId?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof alerts.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(alerts).values({
      patternId,
      departmentId,
      title,
      message,
      severity,
      isActive: true,
      expiresAt,
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    if (userId) {
      await logAudit(userId, "CREATE_ALERT", "alert", Number(lastInsertId), { patternId, severity }, ipAddress, userAgent);
    }

    const created = await db.select().from(alerts).where(eq(alerts.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to create alert:", error);
    throw error;
  }
}

/**
 * Get active alerts for department
 */
export async function getActiveAlerts(departmentId: number): Promise<typeof alerts.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.departmentId, departmentId), eq(alerts.isActive, true)))
      .orderBy(desc(alerts.createdAt));
  } catch (error) {
    console.error("[Support] Failed to get alerts:", error);
    return [];
  }
}

/**
 * Record learning feedback
 */
export async function recordLearningFeedback(
  messageId: number,
  userId: number,
  feedback: "helpful" | "not_helpful" | "partially_helpful",
  rating?: number,
  notes?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof learningInteractions.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(learningInteractions).values({
      messageId,
      userId,
      feedback,
      rating,
      notes,
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    await logAudit(userId, "RECORD_FEEDBACK", "learningInteraction", Number(lastInsertId), { messageId, feedback, rating }, ipAddress, userAgent);

    const created = await db.select().from(learningInteractions).where(eq(learningInteractions.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to record feedback:", error);
    throw error;
  }
}

/**
 * Add documentation source for AI training
 */
export async function addDocumentationSource(
  departmentId: number,
  title: string,
  content: string,
  url?: string,
  category?: string,
  userId?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof documentationSources.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(documentationSources).values({
      departmentId,
      title,
      content,
      url,
      category,
      isActive: true,
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    if (userId) {
      await logAudit(userId, "ADD_DOCUMENTATION", "documentationSource", Number(lastInsertId), { departmentId, category }, ipAddress, userAgent);
    }

    const created = await db.select().from(documentationSources).where(eq(documentationSources.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to add documentation:", error);
    throw error;
  }
}

/**
 * Get documentation for department
 */
export async function getDepartmentDocumentation(departmentId: number, category?: string): Promise<typeof documentationSources.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [eq(documentationSources.departmentId, departmentId), eq(documentationSources.isActive, true)];
    if (category) {
      conditions.push(eq(documentationSources.category, category));
    }

    return await db.select().from(documentationSources).where(and(...conditions)).orderBy(desc(documentationSources.updatedAt));
  } catch (error) {
    console.error("[Support] Failed to get documentation:", error);
    return [];
  }
}

/**
 * Close conversation
 */
export async function closeConversation(
  conversationId: number,
  userId: number,
  summary?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(conversations)
      .set({
        status: "closed",
        closedAt: new Date(),
        summary,
      })
      .where(eq(conversations.id, conversationId));

    await logAudit(userId, "CLOSE_CONVERSATION", "conversation", conversationId, { summary }, ipAddress, userAgent);
  } catch (error) {
    console.error("[Support] Failed to close conversation:", error);
    throw error;
  }
}

/**
 * Get departments
 */
export async function getDepartments(): Promise<typeof departments.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(departments).orderBy(departments.name);
  } catch (error) {
    console.error("[Support] Failed to get departments:", error);
    return [];
  }
}

/**
 * Create department
 */
export async function createDepartment(
  workspaceId: number,
  name: string,
  description?: string,
  userId?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<typeof departments.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(departments).values({
      workspaceId,
      name,
      description,
    });

    const lastInsertId = (result as any)[0]?.insertId || (result as any).insertId;
    if (userId) {
      await logAudit(userId, "CREATE_DEPARTMENT", "department", Number(lastInsertId), { name }, ipAddress, userAgent);
    }

    const created = await db.select().from(departments).where(eq(departments.id, Number(lastInsertId))).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Support] Failed to create department:", error);
    throw error;
  }
}

/**
 * Hash content for pattern detection
 */
async function hashContent(content: string): Promise<string> {
  // Simple hash for pattern detection - in production, use crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

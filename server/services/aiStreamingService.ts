import { getDb } from "../db";
import { documentationSources, messages, conversations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { streamLLM, StreamingCallback } from "../_core/llmStreaming";
import { getKnowledgeBaseContext } from "./knowledgeBaseService";
import { Message } from "../_core/llm";

/**
 * AI Streaming Service - generates contextual responses with real-time streaming
 * Uses the framework's LLM integration (Gemini 2.5 Flash by default)
 */

/**
 * Generate AI response with streaming
 * Retrieves relevant documentation and conversation context
 * Calls onChunk callback for each streamed chunk
 */
export async function generateAIResponseStreaming(
  conversationId: number,
  userMessage: string,
  onChunk: StreamingCallback,
  departmentId?: number
): Promise<string> {
  try {
    // Get relevant documentation for the department (if provided)
    const docs = departmentId ? await getDepartmentContext(departmentId) : await getAllDocumentation();

    // Get knowledge base context for the query
    const kbContext = departmentId ? await getKnowledgeBaseContext(departmentId, userMessage) : "";

    // Get recent conversation history for context
    const history = await getConversationContext(conversationId, 10);

    // Build system prompt for AI with knowledge base context
    const systemPrompt = buildSystemPrompt(docs, kbContext);

    // Build message history for the LLM
    const messageHistory = buildMessageHistory(history, userMessage);

    // Stream the LLM response
    const fullResponse = await streamLLM(
      {
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messageHistory,
        ],
      },
      onChunk
    );

    return fullResponse;
  } catch (error) {
    console.error("[AI Streaming] Failed to generate response:", error);
    const fallback = generateFallbackResponse(userMessage);
    await onChunk(fallback);
    return fallback;
  }
}

/**
 * Get documentation context for a department
 */
async function getDepartmentContext(departmentId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const docs = await db
      .select({ title: documentationSources.title, content: documentationSources.content })
      .from(documentationSources)
      .where(and(eq(documentationSources.departmentId, departmentId), eq(documentationSources.isActive, true)))
      .limit(10);

    return docs
      .map((doc) => `**${doc.title}**\n${doc.content}`)
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("[AI Streaming] Failed to get department context:", error);
    return "";
  }
}

/**
 * Get all active documentation
 */
async function getAllDocumentation(): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const docs = await db
      .select({ title: documentationSources.title, content: documentationSources.content, departmentId: documentationSources.departmentId })
      .from(documentationSources)
      .where(eq(documentationSources.isActive, true))
      .limit(20);

    return docs
      .map((doc) => `**${doc.title}**\n${doc.content}`)
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("[AI Streaming] Failed to get all documentation:", error);
    return "";
  }
}

/**
 * Get recent conversation history for context
 */
async function getConversationContext(conversationId: number, limit: number = 10): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const msgs = await db
      .select({ content: messages.content, senderType: messages.senderType })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(limit);

    return msgs.map((msg) => ({
      role: msg.senderType === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));
  } catch (error) {
    console.error("[AI Streaming] Failed to get conversation context:", error);
    return [];
  }
}

/**
 * Build system prompt for the LLM
 */
function buildSystemPrompt(documentation: string, knowledgeBase: string = ""): string {
  const kbSection = knowledgeBase
    ? `\n\n## Knowledge Base Resources:\n${knowledgeBase}`
    : "";

  return `You are a helpful internal support agent for an organization. You have access to the following documentation to help answer user questions.

Your responsibilities:
1. Answer questions based on the provided documentation and knowledge base
2. Be concise and helpful
3. If you don't have information to answer a question, suggest escalating to a live agent
4. Maintain a professional and friendly tone
5. Provide step-by-step guidance when needed

## Available Documentation:
${documentation || "No documentation available at this time."}${kbSection}

Please provide helpful, accurate responses based on the documentation and knowledge base above.`;
}

/**
 * Build message history for LLM
 */
function buildMessageHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage: string
): Message[] {
  // Include recent history (up to 10 previous exchanges)
  const recentHistory = history.slice(-10);

  return [
    ...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: "user" as const,
      content: currentMessage,
    },
  ];
}

/**
 * Generate a fallback response when LLM is unavailable
 */
function generateFallbackResponse(userMessage: string): string {
  // Simple pattern matching for common requests
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes("password") || lowerMessage.includes("reset")) {
    return "For password reset requests, please visit your organization's identity management portal or contact IT support directly.";
  }

  if (lowerMessage.includes("access") || lowerMessage.includes("permission")) {
    return "Access requests should be submitted through your HR portal or by contacting your manager. Please provide details about what access you need.";
  }

  if (lowerMessage.includes("expense") || lowerMessage.includes("reimbursement")) {
    return "For expense reimbursement, please submit your receipts through the Finance portal. Reimbursements typically process within 5-7 business days.";
  }

  if (lowerMessage.includes("vacation") || lowerMessage.includes("time off")) {
    return "To request time off, please log into the HR portal and submit a time off request. Your manager will need to approve it.";
  }

  // Default response
  return "Thank you for your question. I'm here to help. Could you provide more details about what you need assistance with? If I can't help, I can escalate this to a live agent.";
}

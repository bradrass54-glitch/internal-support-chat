import { getDb } from "../db";
import { documentationSources, messages, conversations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getKnowledgeBaseContext } from "./knowledgeBaseService";

/**
 * AI Service - generates contextual responses based on documentation and conversation history
 * Uses the framework's LLM integration (Gemini 2.5 Flash by default)
 */

/**
 * Generate AI response for a user message
 * Retrieves relevant documentation and conversation context
 */
export async function generateAIResponse(
  conversationId: number,
  userMessage: string,
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

    // Call the LLM with proper context
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messageHistory,
      ],
    });

    // Extract the response text
    const responseText = response.choices[0]?.message?.content;
    if (typeof responseText === "string") {
      return responseText;
    }

    return generateFallbackResponse(userMessage);
  } catch (error) {
    console.error("[AI] Failed to generate response:", error);
    return generateFallbackResponse(userMessage);
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
    console.error("[AI] Failed to get department context:", error);
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
    console.error("[AI] Failed to get all documentation:", error);
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
    console.error("[AI] Failed to get conversation context:", error);
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
): Array<{ role: "user" | "assistant"; content: string }> {
  // Include recent history (up to 5 previous exchanges)
  const recentHistory = history.slice(-10);

  return [
    ...recentHistory,
    {
      role: "user",
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

/**
 * Analyze sentiment and intent from user message
 * Used for routing and pattern detection
 */
export async function analyzeMessage(content: string): Promise<{ sentiment: string; intent: string; entities: string[] }> {
  try {
    // Simple keyword-based analysis (can be enhanced with ML)
    const sentiment = analyzeSentiment(content);
    const intent = analyzeIntent(content);
    const entities = extractEntities(content);

    return {
      sentiment,
      intent,
      entities,
    };
  } catch (error) {
    console.error("[AI] Failed to analyze message:", error);
    return {
      sentiment: "neutral",
      intent: "general_inquiry",
      entities: [],
    };
  }
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(text: string): string {
  const lowerText = text.toLowerCase();

  const positiveWords = ["great", "excellent", "good", "thanks", "appreciate", "helpful", "solved", "fixed"];
  const negativeWords = ["bad", "terrible", "frustrated", "angry", "broken", "not working", "issue", "problem", "error"];

  const positiveCount = positiveWords.filter((word) => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter((word) => lowerText.includes(word)).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

/**
 * Simple intent analysis
 */
function analyzeIntent(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("how") || lowerText.includes("help") || lowerText.includes("guide")) {
    return "how_to";
  }
  if (lowerText.includes("what") || lowerText.includes("tell")) {
    return "information_request";
  }
  if (lowerText.includes("why") || lowerText.includes("reason")) {
    return "explanation";
  }
  if (lowerText.includes("error") || lowerText.includes("problem") || lowerText.includes("issue")) {
    return "problem_report";
  }
  if (lowerText.includes("request") || lowerText.includes("need")) {
    return "request";
  }

  return "general_inquiry";
}

/**
 * Extract entities from message
 */
function extractEntities(text: string): string[] {
  const entities: string[] = [];

  // Extract email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  if (emails) entities.push(...emails);

  // Extract ticket numbers
  const ticketRegex = /[A-Z]+-\d+/g;
  const tickets = text.match(ticketRegex);
  if (tickets) entities.push(...tickets);

  // Extract URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex);
  if (urls) entities.push(...urls);

  return Array.from(new Set(entities)); // Remove duplicates
}

/**
 * Generate summary of conversation
 */
export async function generateConversationSummary(conversationId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const msgs = await db
      .select({ content: messages.content, senderType: messages.senderType })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    if (msgs.length === 0) return "";

    // Simple summary: extract key points from messages
    const userMessages = msgs.filter((m) => m.senderType === "user").map((m) => m.content);
    const summary = userMessages.slice(0, 3).join(" | ");

    return summary.substring(0, 200) + (summary.length > 200 ? "..." : "");
  } catch (error) {
    console.error("[AI] Failed to generate summary:", error);
    return "";
  }
}

/**
 * Detect which department a message relates to
 */
export async function detectDepartment(userMessage: string): Promise<string | null> {
  const lowerMessage = userMessage.toLowerCase();

  // IT keywords
  if (
    lowerMessage.includes("password") ||
    lowerMessage.includes("vpn") ||
    lowerMessage.includes("software") ||
    lowerMessage.includes("computer") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("email") ||
    lowerMessage.includes("access")
  ) {
    return "IT";
  }

  // HR keywords
  if (
    lowerMessage.includes("vacation") ||
    lowerMessage.includes("time off") ||
    lowerMessage.includes("benefits") ||
    lowerMessage.includes("policy") ||
    lowerMessage.includes("hr") ||
    lowerMessage.includes("leave") ||
    lowerMessage.includes("enrollment")
  ) {
    return "HR";
  }

  // Finance keywords
  if (
    lowerMessage.includes("expense") ||
    lowerMessage.includes("reimbursement") ||
    lowerMessage.includes("purchase order") ||
    lowerMessage.includes("invoice") ||
    lowerMessage.includes("payroll") ||
    lowerMessage.includes("finance") ||
    lowerMessage.includes("budget")
  ) {
    return "Finance";
  }

  return null;
}

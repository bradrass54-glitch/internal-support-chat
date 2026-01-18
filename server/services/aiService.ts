import { getDb } from "../db";
import { documentationSources, messages, conversations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * AI Service - generates contextual responses based on documentation and conversation history
 * Uses LLM integration from the core framework
 */

/**
 * Generate AI response for a user message
 * Retrieves relevant documentation and conversation context
 */
export async function generateAIResponse(
  conversationId: number,
  userMessage: string,
  departmentId: number
): Promise<string> {
  try {
    // Get relevant documentation for the department
    const docs = await getDepartmentContext(departmentId);

    // Get recent conversation history for context
    const history = await getConversationContext(conversationId, 5);

    // Build context for AI
    const context = buildContext(docs, history, userMessage);

    // Generate response using LLM
    const response = await callLLM(context, userMessage);

    return response;
  } catch (error) {
    console.error("[AI] Failed to generate response:", error);
    return "I apologize, but I'm unable to generate a response at this moment. Please try again or escalate to a live agent.";
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
 * Get recent conversation history for context
 */
async function getConversationContext(conversationId: number, limit: number = 5): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    const msgs = await db
      .select({ content: messages.content, senderType: messages.senderType })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(limit);

    return msgs
      .map((msg) => `[${msg.senderType.toUpperCase()}]: ${msg.content}`)
      .join("\n");
  } catch (error) {
    console.error("[AI] Failed to get conversation context:", error);
    return "";
  }
}

/**
 * Build context prompt for LLM
 */
function buildContext(documentation: string, history: string, userMessage: string): string {
  return `You are a helpful internal support agent for an organization. You have access to the following documentation and conversation history to help answer user questions.

## Available Documentation:
${documentation || "No documentation available for this department."}

## Conversation History:
${history || "No previous messages in this conversation."}

## Current User Question:
${userMessage}

Please provide a helpful, concise response based on the available documentation. If you don't have information to answer the question, suggest escalating to a live agent.`;
}

/**
 * Call the LLM API to generate a response
 * This integrates with the framework's LLM capabilities
 */
async function callLLM(context: string, userMessage: string): Promise<string> {
  try {
    // This would integrate with your LLM provider (OpenAI, Claude, etc.)
    // For now, return a placeholder that indicates the system is ready for integration
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: context,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.warn("[AI] LLM API error:", response.statusText);
      return generateFallbackResponse(userMessage);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || generateFallbackResponse(userMessage);
  } catch (error) {
    console.warn("[AI] Failed to call LLM:", error);
    return generateFallbackResponse(userMessage);
  }
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

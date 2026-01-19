import { getDb } from "../db";
import { knowledgeBaseDocuments, knowledgeBaseChunks, InsertKnowledgeBaseDocument } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut, storageGet } from "../storage";
import { logAudit } from "./supportService";

/**
 * Extract text from uploaded file
 * In production, use PDF parser, docx parser, etc.
 */
export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  // For now, return a placeholder
  // In production, integrate with PDF parsing libraries
  if (mimeType === "application/pdf") {
    return "[PDF content would be extracted here]";
  } else if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }
  return "[File content extraction not supported for this format]";
}

/**
 * Split text into chunks for semantic search
 */
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start = end - overlap;
  }

  return chunks;
}

/**
 * Upload and process a knowledge base document
 */
export async function uploadKnowledgeBaseDocument(
  workspaceId: number,
  departmentId: number,
  userId: number,
  file: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  },
  metadata: {
    title: string;
    description?: string;
    tags?: string;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Upload file to S3
    const fileKey = `knowledge-base/${departmentId}/${Date.now()}-${file.fileName}`;
    const { url: fileUrl } = await storagePut(fileKey, file.buffer, file.mimeType);

    // Extract text from file
    const extractedText = await extractTextFromFile(file.buffer, file.mimeType);

    // Create document record
    const result = await db.insert(knowledgeBaseDocuments).values({
      workspaceId,
      departmentId,
      title: metadata.title,
      description: metadata.description,
      fileKey,
      fileUrl,
      fileName: file.fileName,
      fileSize: file.buffer.length,
      mimeType: file.mimeType,
      extractedText,
      status: "processing",
      uploadedBy: userId,
      tags: metadata.tags,
    });

    const documentId = (result as any).insertId as number;

    // Create text chunks
    const chunks = chunkText(extractedText);
    for (let i = 0; i < chunks.length; i++) {
      await db.insert(knowledgeBaseChunks).values({
        documentId,
        chunkIndex: i,
        content: chunks[i],
        tokens: Math.ceil(chunks[i].split(/\s+/).length / 1.3), // Rough token estimate
      });
    }

    // Update document status to ready
    await db
      .update(knowledgeBaseDocuments)
      .set({ status: "ready" })
      .where(eq(knowledgeBaseDocuments.id, documentId));

    // Log audit event
    await logAudit(userId, "KNOWLEDGE_BASE_UPLOAD", `Uploaded document: ${metadata.title}`);

    return documentId;
  } catch (error) {
    console.error("[Knowledge Base] Upload failed:", error);
    throw error;
  }
}

/**
 * Get all documents for a department
 */
export async function getDocumentsByDepartment(
  departmentId: number,
  includeArchived: boolean = false
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    if (includeArchived) {
      return await db
        .select()
        .from(knowledgeBaseDocuments)
        .where(eq(knowledgeBaseDocuments.departmentId, departmentId))
        .orderBy(desc(knowledgeBaseDocuments.createdAt));
    } else {
      return await db
        .select()
        .from(knowledgeBaseDocuments)
        .where(
          and(
            eq(knowledgeBaseDocuments.departmentId, departmentId),
            eq(knowledgeBaseDocuments.status, "ready")
          )
        )
        .orderBy(desc(knowledgeBaseDocuments.createdAt));
    }
  } catch (error) {
    console.error("[Knowledge Base] Failed to fetch documents:", error);
    return [];
  }
}

/**
 * Get document by ID
 */
export async function getDocumentById(documentId: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(knowledgeBaseDocuments)
      .where(eq(knowledgeBaseDocuments.id, documentId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Knowledge Base] Failed to fetch document:", error);
    return null;
  }
}

/**
 * Get chunks for a document
 */
export async function getDocumentChunks(documentId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(knowledgeBaseChunks)
      .where(eq(knowledgeBaseChunks.documentId, documentId))
      .orderBy(knowledgeBaseChunks.chunkIndex);
  } catch (error) {
    console.error("[Knowledge Base] Failed to fetch chunks:", error);
    return [];
  }
}

/**
 * Delete a document (soft delete - archive)
 */
export async function archiveDocument(documentId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const doc = await getDocumentById(documentId);
    if (!doc) throw new Error("Document not found");

    await db
      .update(knowledgeBaseDocuments)
      .set({ status: "archived", archivedAt: new Date() })
      .where(eq(knowledgeBaseDocuments.id, documentId));

    await logAudit(userId, "KNOWLEDGE_BASE_ARCHIVE", `Archived document: ${doc.title}`);
  } catch (error) {
    console.error("[Knowledge Base] Failed to archive document:", error);
    throw error;
  }
}

/**
 * Search knowledge base for relevant content
 */
export async function searchKnowledgeBase(
  departmentId: number,
  query: string,
  limit: number = 5
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get all documents for department
    const docs = await db
      .select()
      .from(knowledgeBaseDocuments)
      .where(
        and(
          eq(knowledgeBaseDocuments.departmentId, departmentId),
          eq(knowledgeBaseDocuments.status, "ready")
        )
      );

    // Simple keyword search (in production, use semantic search with embeddings)
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results: any[] = [];

    for (const doc of docs) {
      const text = (doc.extractedText || "").toLowerCase();
      let matchScore = 0;

      for (const term of queryTerms) {
        const matches = text.match(new RegExp(term, "g"));
        matchScore += (matches?.length || 0);
      }

      if (matchScore > 0) {
        results.push({
          ...doc,
          matchScore,
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
  } catch (error) {
    console.error("[Knowledge Base] Search failed:", error);
    return [];
  }
}

/**
 * Get knowledge base context for AI prompt
 */
export async function getKnowledgeBaseContext(departmentId: number, query: string): Promise<string> {
  const results = await searchKnowledgeBase(departmentId, query, 3);

  if (results.length === 0) {
    return "";
  }

  let context = "Relevant knowledge base documents:\n\n";
  for (const doc of results) {
    context += `**${doc.title}**\n`;
    if (doc.description) {
      context += `${doc.description}\n`;
    }
    if (doc.extractedText) {
      // Include first 500 chars of extracted text
      context += `${doc.extractedText.substring(0, 500)}...\n`;
    }
    context += "\n";
  }

  return context;
}

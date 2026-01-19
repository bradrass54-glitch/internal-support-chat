import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  uploadKnowledgeBaseDocument,
  getDocumentsByDepartment,
  getDocumentById,
  archiveDocument,
  getKnowledgeBaseContext,
} from "../services/knowledgeBaseService";
import { TRPCError } from "@trpc/server";

export const knowledgeBaseRouter = router({
  /**
   * Upload a knowledge base document
   * Admin only
   */
  uploadDocument: adminProcedure
    .input(
      z.object({
        departmentId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        tags: z.string().optional(),
        fileBuffer: z.instanceof(Buffer),
        fileName: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const documentId = await uploadKnowledgeBaseDocument(
          ctx.workspace?.id || 1,
          input.departmentId,
          ctx.user.id,
          {
            buffer: input.fileBuffer,
            fileName: input.fileName,
            mimeType: input.mimeType,
          },
          {
            title: input.title,
            description: input.description,
            tags: input.tags,
          }
        );

        return {
          success: true,
          documentId,
          message: "Document uploaded successfully",
        };
      } catch (error) {
        console.error("[Knowledge Base Router] Upload failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload document",
        });
      }
    }),

  /**
   * Get all documents for a department
   */
  getDocuments: protectedProcedure
    .input(
      z.object({
        departmentId: z.number(),
        includeArchived: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      try {
        const documents = await getDocumentsByDepartment(
          input.departmentId,
          input.includeArchived
        );

        return {
          documents,
          total: documents.length,
        };
      } catch (error) {
        console.error("[Knowledge Base Router] Fetch failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch documents",
        });
      }
    }),

  /**
   * Get a specific document
   */
  getDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      try {
        const document = await getDocumentById(input.documentId);

        if (!document) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }

        return document;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Knowledge Base Router] Fetch failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch document",
        });
      }
    }),

  /**
   * Archive a document
   * Admin only
   */
  archiveDocument: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await archiveDocument(input.documentId, ctx.user.id);

        return {
          success: true,
          message: "Document archived successfully",
        };
      } catch (error) {
        console.error("[Knowledge Base Router] Archive failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to archive document",
        });
      }
    }),

  /**
   * Get knowledge base context for AI
   * Used internally to provide context to AI responses
   */
  getContext: protectedProcedure
    .input(
      z.object({
        departmentId: z.number(),
        query: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const context = await getKnowledgeBaseContext(input.departmentId, input.query);

        return {
          context,
          hasContext: context.length > 0,
        };
      } catch (error) {
        console.error("[Knowledge Base Router] Context fetch failed:", error);
        // Return empty context on error instead of throwing
        return {
          context: "",
          hasContext: false,
        };
      }
    }),
});

import type {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
} from "../knowledge/types.js";

export type CaptureKnowledgeDocumentInput = {
  workspaceId: string;
  sourceId: string;
  externalId: string | null;
  folderPath: string | null;
  title: string;
  content: string;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  status?: KnowledgeDocumentStatus;
};

export interface KnowledgeCapturePort {
  capture(
    input: CaptureKnowledgeDocumentInput,
  ): Promise<KnowledgeDocument>;
}

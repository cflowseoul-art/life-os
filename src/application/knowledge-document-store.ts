import type {
  KnowledgeDocument,
  SaveKnowledgeDocumentInput,
} from "../knowledge/types.js";
import type { Tx } from "./unit-of-work.js";

export interface KnowledgeDocumentStore {
  save(
    tx: Tx,
    document: SaveKnowledgeDocumentInput,
  ): Promise<KnowledgeDocument>;

  findById(
    tx: Tx,
    workspaceId: string,
    documentId: string,
  ): Promise<KnowledgeDocument | null>;

  findByExternalId(
    tx: Tx,
    workspaceId: string,
    sourceId: string,
    externalId: string,
  ): Promise<KnowledgeDocument | null>;

  listByWorkspaceId(
    tx: Tx,
    workspaceId: string,
  ): Promise<KnowledgeDocument[]>;
}
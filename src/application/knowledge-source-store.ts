import type {
  KnowledgeSource,
  SaveKnowledgeSourceInput,
} from "../knowledge/types.js";
import type { Tx } from "./unit-of-work.js";

export interface KnowledgeSourceStore {
  save(
    tx: Tx,
    source: SaveKnowledgeSourceInput,
  ): Promise<KnowledgeSource>;

  findById(
    tx: Tx,
    workspaceId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null>;

  findByExternalReference(
    tx: Tx,
    workspaceId: string,
    externalReference: string,
  ): Promise<KnowledgeSource | null>;

  listByWorkspaceId(
    tx: Tx,
    workspaceId: string,
  ): Promise<KnowledgeSource[]>;
}

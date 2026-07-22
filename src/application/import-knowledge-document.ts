import {
  createHash,
  randomUUID,
} from "node:crypto";

import type {
  KnowledgeCapturePort,
  CaptureKnowledgeDocumentInput,
} from "./knowledge-capture-port.js";
import type { KnowledgeDocumentStore } from "./knowledge-document-store.js";
import type { UnitOfWork } from "./unit-of-work.js";
import type {
  KnowledgeDocument,
  SaveKnowledgeDocumentInput,
} from "../knowledge/types.js";

type CreateId = () => string;
type GetCurrentTime = () => string;
type CreateContentHash = (content: string) => string;

export class ImportKnowledgeDocument
  implements KnowledgeCapturePort
{
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly knowledgeDocumentStore: KnowledgeDocumentStore,
    private readonly createId: CreateId = randomUUID,
    private readonly getCurrentTime: GetCurrentTime = () =>
      new Date().toISOString(),
    private readonly createContentHash: CreateContentHash = (
      content,
    ) =>
      createHash("sha256")
        .update(content, "utf8")
        .digest("hex"),
  ) {}

  async capture(
    input: CaptureKnowledgeDocumentInput,
  ): Promise<KnowledgeDocument> {
    this.validate(input);

    return this.unitOfWork.transaction(async (tx) => {
      const existingDocument =
        input.externalId === null
          ? null
          : await this.knowledgeDocumentStore
              .findByExternalId(
                tx,
                input.workspaceId,
                input.sourceId,
                input.externalId,
              );

      const document: SaveKnowledgeDocumentInput = {
        documentId:
          existingDocument?.documentId ?? this.createId(),
        workspaceId: input.workspaceId,
        sourceId: input.sourceId,
        externalId: input.externalId,
        folderPath: input.folderPath,
        title: input.title.trim(),
        content: input.content,
        sourceCreatedAt: input.sourceCreatedAt,
        sourceUpdatedAt: input.sourceUpdatedAt,
        importedAt: this.getCurrentTime(),
        contentHash: this.createContentHash(
          input.content,
        ),
        status: input.status ?? "active",
      };

      return this.knowledgeDocumentStore.save(
        tx,
        document,
      );
    });
  }

  private validate(
    input: CaptureKnowledgeDocumentInput,
  ): void {
    if (input.workspaceId.trim().length === 0) {
      throw new Error("workspaceId is required");
    }

    if (input.sourceId.trim().length === 0) {
      throw new Error("sourceId is required");
    }

    if (input.title.trim().length === 0) {
      throw new Error("title is required");
    }

    if (input.content.trim().length === 0) {
      throw new Error("content is required");
    }
  }
}

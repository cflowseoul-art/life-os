import type { KnowledgeDocumentStore } from "./knowledge-document-store.js";
import type { UnitOfWork } from "./unit-of-work.js";
import type { KnowledgeDocument } from "../knowledge/types.js";

export class GetKnowledgeDocuments {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly knowledgeDocumentStore: KnowledgeDocumentStore,
  ) {}

  async execute(
    workspaceId: string,
  ): Promise<KnowledgeDocument[]> {
    if (workspaceId.trim().length === 0) {
      throw new Error("workspaceId is required");
    }

    return this.unitOfWork.transaction((tx) =>
      this.knowledgeDocumentStore
        .listByWorkspaceId(
          tx,
          workspaceId,
        ),
    );
  }
}

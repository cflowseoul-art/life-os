import { randomUUID } from "node:crypto";

import type { KnowledgeSourceStore } from "./knowledge-source-store.js";
import type { UnitOfWork } from "./unit-of-work.js";
import type {
  KnowledgeSource,
  KnowledgeSourceType,
  SaveKnowledgeSourceInput,
} from "../knowledge/types.js";

export type SaveKnowledgeSourceCommand = {
  sourceId?: string;
  workspaceId: string;
  sourceType: KnowledgeSourceType;
  name: string;
  externalReference: string | null;
};

type CreateId = () => string;
type GetCurrentTime = () => string;

export class SaveKnowledgeSource {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly knowledgeSourceStore: KnowledgeSourceStore,
    private readonly createId: CreateId = randomUUID,
    private readonly getCurrentTime: GetCurrentTime = () =>
      new Date().toISOString(),
  ) {}

  async execute(
    command: SaveKnowledgeSourceCommand,
  ): Promise<KnowledgeSource> {
    this.validate(command);

    return this.unitOfWork.transaction(async (tx) => {
      const existingSource =
        command.externalReference === null
          ? null
          : await this.knowledgeSourceStore
              .findByExternalReference(
                tx,
                command.workspaceId,
                command.externalReference,
              );

      const currentTime = this.getCurrentTime();

      const source: SaveKnowledgeSourceInput = {
        sourceId:
          existingSource?.sourceId
          ?? command.sourceId
          ?? this.createId(),
        workspaceId: command.workspaceId,
        sourceType: command.sourceType,
        name: command.name.trim(),
        externalReference:
          command.externalReference,
        createdAt:
          existingSource?.createdAt
          ?? currentTime,
        updatedAt: currentTime,
      };

      return this.knowledgeSourceStore.save(
        tx,
        source,
      );
    });
  }

  private validate(
    command: SaveKnowledgeSourceCommand,
  ): void {
    if (command.workspaceId.trim().length === 0) {
      throw new Error("workspaceId is required");
    }

    if (command.name.trim().length === 0) {
      throw new Error("name is required");
    }

    if (
      command.sourceId !== undefined
      && command.sourceId.trim().length === 0
    ) {
      throw new Error(
        "sourceId must not be empty",
      );
    }
  }
}

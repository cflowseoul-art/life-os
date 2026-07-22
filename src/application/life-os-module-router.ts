import type { InventoryItemState } from "../household-supplies/types.js";
import type { KnowledgeDocument } from "../knowledge/types.js";

export type LifeOsModuleRequest =
  | {
      module: "inventory";
      action: "list";
      workspaceId: string;
    }
  | {
      module: "knowledge";
      action: "list";
      workspaceId: string;
    };

export type LifeOsModuleResult =
  | {
      module: "inventory";
      action: "list";
      data: InventoryItemState[];
    }
  | {
      module: "knowledge";
      action: "list";
      data: KnowledgeDocument[];
    };

export interface InventoryReader {
  execute(
    workspaceId: string,
  ): Promise<InventoryItemState[]>;
}

export interface KnowledgeDocumentReader {
  execute(
    workspaceId: string,
  ): Promise<KnowledgeDocument[]>;
}

export class LifeOsModuleRouter {
  constructor(
    private readonly inventoryReader: InventoryReader,
    private readonly knowledgeDocumentReader: KnowledgeDocumentReader,
  ) {}

  async route(
    request: LifeOsModuleRequest,
  ): Promise<LifeOsModuleResult> {
    if (request.module === "inventory") {
      return {
        module: "inventory",
        action: "list",
        data: await this.inventoryReader.execute(
          request.workspaceId,
        ),
      };
    }

    return {
      module: "knowledge",
      action: "list",
      data: await this.knowledgeDocumentReader.execute(
        request.workspaceId,
      ),
    };
  }
}

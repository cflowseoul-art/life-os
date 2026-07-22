// Knowledge domain types.
// Pure types only. No persistence or external importer implementation here.

export type CanonicalProduct = {
  id: string;
  canonicalName: string;
  baseUnit: string;
};

export type ProductAlias = {
  alias: string;
  canonicalProductId: string;
};

export type UnitConversion = {
  canonicalProductId: string;
  fromUnit: string;
  toBaseFactor: number;
};

export type ProductKnowledgeSnapshot = {
  products: CanonicalProduct[];
  aliases: ProductAlias[];
  unitConversions: UnitConversion[];
};

// Backward-compatible name for existing household-supplies code.
export type KnowledgeSnapshot =
  ProductKnowledgeSnapshot;

export type KnowledgeSourceType =
  | "apple_notes"
  | "markdown"
  | "web_clip"
  | "manual";

export type KnowledgeSource = {
  sourceId: string;
  workspaceId: string;
  sourceType: KnowledgeSourceType;
  name: string;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveKnowledgeSourceInput = {
  sourceId: string;
  workspaceId: string;
  sourceType: KnowledgeSourceType;
  name: string;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeDocumentStatus =
  | "active"
  | "archived"
  | "deleted";

export type KnowledgeDocument = {
  documentId: string;
  workspaceId: string;
  sourceId: string;
  externalId: string | null;
  folderPath: string | null;
  title: string;
  content: string;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  importedAt: string;
  contentHash: string;
  status: KnowledgeDocumentStatus;
};

export type SaveKnowledgeDocumentInput = {
  documentId: string;
  workspaceId: string;
  sourceId: string;
  externalId: string | null;
  folderPath: string | null;
  title: string;
  content: string;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  importedAt: string;
  contentHash: string;
  status: KnowledgeDocumentStatus;
};

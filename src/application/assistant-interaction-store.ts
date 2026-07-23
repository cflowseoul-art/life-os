export interface AssistantInteractionStore {
  save(input: {
    workspaceId: string;
    inputText: string;
    intent?: string;
    commandType?: string;
    success: boolean;
    responseTimeMs?: number;
    metadata?: unknown;
  }): Promise<void>;
}

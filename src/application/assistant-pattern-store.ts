export interface AssistantPatternStore {

  find(
    input: {
      workspaceId: string;
      inputText: string;
    }
  ): Promise<{
    intent: string;
    commandType: string;
    payload: unknown;
    hitCount: number;
  } | null>;


  save(
    input: {
      workspaceId: string;
      inputText: string;
      intent: string;
      commandType: string;
      payload: unknown;
    }
  ): Promise<void>;

}

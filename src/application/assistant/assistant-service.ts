export type AssistantInput = {
  text: string;
  workspaceId: string;
  householdId: string;
  actorId: string;
};

export class AssistantService {
  constructor(
    private readonly inventoryHandler: {
      handle(
        input: AssistantInput,
      ): Promise<unknown>;
    },
  ) {}

  async handle(
    input: AssistantInput,
  ): Promise<unknown> {
    return this.inventoryHandler.handle(
      input,
    );
  }
}

import type {
  LlmClient,
} from "../../src/application/llm-client.js";

export class FakeLlmClient
  implements LlmClient
{
  constructor(
    private readonly responses:
      Record<string, string>,
  ) {}

  async generate(
    input: string,
  ): Promise<string> {
    const response =
      this.responses[input];

    if (!response) {
      throw new Error(
        `No fake response configured for: ${input}`,
      );
    }

    return response;
  }
}

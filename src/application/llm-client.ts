export interface LlmClient {
  generate(
    prompt: string,
  ): Promise<string>;
}

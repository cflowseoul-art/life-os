export interface LlmClient {
  generate(
    input: string,
  ): Promise<string>;
}

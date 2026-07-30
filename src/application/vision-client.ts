export interface VisionClient {
  analyzeImage(
    imageBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string>;
}

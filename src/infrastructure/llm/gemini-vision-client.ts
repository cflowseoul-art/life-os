import type {
  VisionClient,
} from "../../application/vision-client.js";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class GeminiVisionClient
  implements VisionClient
{
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async analyzeImage(
    imageBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response =
      await fetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: imageBase64,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      );

    if (!response.ok) {
      const errorBody =
        await response.text();

      throw new Error(
        `Gemini Vision API error: ${response.status}\n${errorBody}`,
      );
    }

    const data =
      await response.json() as GeminiResponse;

    const text =
      data.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text;

    if (!text) {
      throw new Error(
        "Gemini Vision returned empty response",
      );
    }

    return text;
  }
}

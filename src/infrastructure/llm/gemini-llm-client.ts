import type {
  LlmClient,
} from "../../application/llm-client.js";


type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class GeminiLlmClient
  implements LlmClient
{
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generate(
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
                    text:
                      this.buildPrompt(prompt),
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
        `Gemini API error: ${response.status}\n${errorBody}`,
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
        "Gemini returned empty response",
      );
    }

    return text;
  }

  private buildPrompt(
    prompt: string,
  ): string {
    return `
Convert the user's inventory command into JSON.

Rules:
- Return JSON only.
- Do not include markdown.
- Do not resolve products.
- Do not convert units.
- Use adjust_inventory when the user states the current inventory should be changed to a specific quantity.

Schema:
{
  "intent": "purchase_inventory" | "consume_inventory" | "adjust_inventory" | null,
  "items": [
    {
      "rawName": string,
      "quantity": number,
      "unit": string
    }
  ],
  "confidence": number,
  "requiresClarification": boolean,
  "unsupportedReason": 
    "unsupported_intent" |
    "unknown_product" |
    "ambiguous_quantity" |
    "insufficient_recorded_stock" optional
}

User input:
${prompt}
`;
  }
}

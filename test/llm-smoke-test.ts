import "dotenv/config";
import { LlmInventoryCommandParser } from "../src/household-supplies/parser/llm-inventory-command-parser.js";
import { GeminiLlmClient } from "../src/infrastructure/llm/gemini-llm-client.js";

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY missing",
  );
}

const parser =
  new LlmInventoryCommandParser(
    new GeminiLlmClient(
      apiKey,
      process.env.GEMINI_MODEL ??
        "gemini-2.5-flash",
    ),
  );

const cases = [
  "계란 한 판 샀어",
  "마트 갔다가 특란 한 판이랑 우유 두 개 사왔어",
  "오늘 날씨 좋아",
];

for (const input of cases) {
  console.log("\nINPUT:", input);

  const result =
    await parser.parse(
      input,
      "workspace-1",
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2,
    ),
  );
}

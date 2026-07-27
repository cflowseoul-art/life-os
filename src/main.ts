import { Pool } from "pg";

import { ExecuteInventoryCommand } from "./application/execute-inventory-command.js";
import { ExecuteInventoryText } from "./application/execute-inventory-text.js";
import { RuleInventoryCommandParser } from "./household-supplies/parser/rule-inventory-command-parser.js";
import { LlmInventoryCommandParser } from "./household-supplies/parser/llm-inventory-command-parser.js";
import { InventoryCommandParserRouter } from "./household-supplies/parser/inventory-command-parser-router.js";
import { PostgresProductResolver } from "./infrastructure/postgres/postgres-product-resolver.js";
import { PostgresUnitConversionResolver } from "./infrastructure/postgres/postgres-unit-conversion-resolver.js";

import { GetInventory } from "./application/get-inventory.js";
import { QueryInventoryText } from "./application/query-inventory-text.js";
import { AnswerInventoryText } from "./application/answer-inventory-text.js";
import { GetKnowledgeDocuments } from "./application/get-knowledge-documents.js";
import { LifeOsModuleRouter } from "./application/life-os-module-router.js";
import { PostgresInventoryEventStore } from "./infrastructure/postgres/postgres-inventory-event-store.js";
import { PostgresInventoryProjector } from "./infrastructure/postgres/postgres-inventory-projector.js";
import { PostgresInventoryQueryStore } from "./infrastructure/postgres/postgres-inventory-query-store.js";
import { PostgresKnowledgeDocumentStore } from "./infrastructure/postgres/postgres-knowledge-document-store.js";
import { PostgresProcessedCommandStore } from "./infrastructure/postgres/postgres-processed-command-store.js";
import { PostgresUnitOfWork } from "./infrastructure/postgres/postgres-unit-of-work.js";
import { LifeOsHttpHandler } from "./interfaces/http/life-os-http-handler.js";
import { startNodeHttpServer } from "./interfaces/http/node-http-server.js";
import { GeminiLlmClient } from "./infrastructure/llm/gemini-llm-client.js";
import { InventoryCapability } from "./application/capabilities/inventory-capability.js";
import { AssistantService } from "./application/assistant/assistant-service.js";
import { InventoryAssistantHandler } from "./application/assistant/inventory-assistant-handler.js";
import { PostgresAssistantInteractionStore } from "./infrastructure/postgres/postgres-assistant-interaction-store.js";
import { PostgresAssistantPatternStore } from "./infrastructure/postgres/postgres-assistant-pattern-store.js";
import { InventoryLanguageRouter } from "./application/assistant/inventory-language-router.js";
import { InventoryIntentRouter } from "./application/assistant/inventory-intent-router.js";
import { PatternCommandBuilder } from "./application/assistant/pattern-command-builder.js";

import { LlmInventoryQueryParser } from "./household-supplies/parser/llm-inventory-query-parser.js";


const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required",
  );
}

const rawPort =
  process.env.PORT ?? "3000";

const port = Number.parseInt(
  rawPort,
  10,
);

if (
  !Number.isInteger(port)
  || port < 1
  || port > 65_535
) {
  throw new Error(
    `Invalid PORT value: ${rawPort}`,
  );
}

const host =
  process.env.HOST ?? "127.0.0.1";

const pool = new Pool({
  connectionString: databaseUrl,
});

const unitOfWork =
  new PostgresUnitOfWork(pool);

const inventoryEventStore =
  new PostgresInventoryEventStore();

const inventoryProjector =
  new PostgresInventoryProjector();

const processedCommandStore =
  new PostgresProcessedCommandStore();

const executeInventoryCommand =
  new ExecuteInventoryCommand(
    unitOfWork,
    inventoryEventStore,
    inventoryProjector,
    processedCommandStore,
  );

const geminiApiKey =
  process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  throw new Error(
    "GEMINI_API_KEY environment variable is required",
  );
}

const geminiClient =
  new GeminiLlmClient(
    geminiApiKey,
    process.env.GEMINI_MODEL ??
      "gemini-2.5-flash",
  );

const ruleInventoryCommandParser =
  new RuleInventoryCommandParser();

const llmInventoryCommandParser =
  new LlmInventoryCommandParser(
    geminiClient,
  );

const inventoryCommandParser =
  new InventoryCommandParserRouter(
    ruleInventoryCommandParser,
    llmInventoryCommandParser,
  );

const productResolver =
  new PostgresProductResolver(pool);

const unitConversionResolver =
  new PostgresUnitConversionResolver(pool);

const executeInventoryText =
  new ExecuteInventoryText(
    inventoryCommandParser,
    productResolver,
    unitConversionResolver,
    executeInventoryCommand,
  );

const inventoryQueryStore =
  new PostgresInventoryQueryStore();

const knowledgeDocumentStore =
  new PostgresKnowledgeDocumentStore();

const getInventory =
  new GetInventory(
    unitOfWork,
    inventoryQueryStore,
  );

const inventoryQueryParser =
  new LlmInventoryQueryParser(
    geminiClient,
  );

const queryInventoryText =
  new QueryInventoryText(
    getInventory,
    inventoryQueryParser,
  );

const answerInventoryText =
  new AnswerInventoryText(
    queryInventoryText,
  );

const inventoryCapability =
  new InventoryCapability(
    executeInventoryText,
    queryInventoryText,
    answerInventoryText,
    executeInventoryCommand,
  );

const assistantInteractionStore =
  new PostgresAssistantInteractionStore(
    pool,
  );


const assistantPatternStore =
  new PostgresAssistantPatternStore(
    pool,
  );


const patternCommandBuilder =
  new PatternCommandBuilder();


const inventoryIntentRouter =
  new InventoryIntentRouter();


const inventoryAssistantHandler =
  new InventoryAssistantHandler(
    inventoryCapability,
    inventoryQueryParser,
    inventoryCommandParser,
    assistantInteractionStore,
    assistantPatternStore,
    patternCommandBuilder,
  );

const assistantService =
  new AssistantService(
    inventoryAssistantHandler,
  );

const getKnowledgeDocuments =
  new GetKnowledgeDocuments(
    unitOfWork,
    knowledgeDocumentStore,
  );

const moduleRouter =
  new LifeOsModuleRouter(
    getInventory,
    getKnowledgeDocuments,
  );

const httpHandler =
  new LifeOsHttpHandler(
    moduleRouter,
    executeInventoryCommand,
    executeInventoryText,
    undefined,
    assistantService,
  );

const server =
  await startNodeHttpServer(
    httpHandler,
    {
      host,
      port,
    },
  );

console.log(
  `Life OS API listening on http://${host}:${port}`,
);

let isShuttingDown = false;

async function shutdown(
  signal: string,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `Received ${signal}. Shutting down.`,
  );

  await new Promise<void>(
    (resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    },
  );

  await pool.end();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT").then(
    () => {
      process.exitCode = 0;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM").then(
    () => {
      process.exitCode = 0;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
});

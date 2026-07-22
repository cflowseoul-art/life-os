import { Pool } from "pg";

import { GetInventory } from "./application/get-inventory.js";
import { GetKnowledgeDocuments } from "./application/get-knowledge-documents.js";
import { LifeOsModuleRouter } from "./application/life-os-module-router.js";
import { PostgresInventoryQueryStore } from "./infrastructure/postgres/postgres-inventory-query-store.js";
import { PostgresKnowledgeDocumentStore } from "./infrastructure/postgres/postgres-knowledge-document-store.js";
import { PostgresUnitOfWork } from "./infrastructure/postgres/postgres-unit-of-work.js";
import { LifeOsHttpHandler } from "./interfaces/http/life-os-http-handler.js";
import { startNodeHttpServer } from "./interfaces/http/node-http-server.js";

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

const inventoryQueryStore =
  new PostgresInventoryQueryStore();

const knowledgeDocumentStore =
  new PostgresKnowledgeDocumentStore();

const getInventory =
  new GetInventory(
    unitOfWork,
    inventoryQueryStore,
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
  new LifeOsHttpHandler(moduleRouter);

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

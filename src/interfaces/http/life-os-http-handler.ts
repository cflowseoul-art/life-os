import type {
  LifeOsModuleRequest,
  LifeOsModuleResult,
  LifeOsModuleRouter,
} from "../../application/life-os-module-router.js";
import type {
  ExecutedResult,
  InventoryCommand,
  InventoryLine,
} from "../../household-supplies/types.js";
import type {
  ExecuteInventoryText,
} from "../../application/execute-inventory-text.js";

import type {
  AssistantService,
} from "../../application/assistant/assistant-service.js";

import type {
  QueryInventoryText,
} from "../../application/query-inventory-text.js";

import type {
  ReceiptAnalyzer,
} from "../../application/receipt/receipt-analyzer.js";
import type {
  ExecuteReceiptInventory,
} from "../../application/receipt/execute-receipt-inventory.js";

import type {
  ResumeRunService,
} from "../../application/resume/resume-run-service.js";
export type HttpRequest = {
  method: string;
  url: string;
  body?: string;
};

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

type ModuleRouter = Pick<
  LifeOsModuleRouter,
  "route"
>;

type InventoryTextQueryExecutor = {
  execute(input: {
    text: string;
    workspaceId: string;
  }): Promise<unknown>;
};

export interface InventoryCommandExecutor {
  execute(
    command: InventoryCommand,
  ): Promise<ExecutedResult>;
}

type MatchedRoute =
  | {
      kind: "health";
    }
  | {
      kind: "module";
      request: LifeOsModuleRequest;
    }
  | {
      kind: "inventory-command";
      workspaceId: string;
    }
  | {
      kind: "inventory-text";
      workspaceId: string;
    }
  | {
      kind: "assistant-text";
      workspaceId: string;
    }
  | {
      kind: "inventory-query";
      workspaceId: string;
    }
  | {
      kind: "receipt-analyze";
      workspaceId: string;
    }
  | {
      kind: "resume-run-start";
      workspaceId: string;
    }
  | {
      kind: "resume-run-status";
      workspaceId: string;
      runId: string;
    }
  | {
      kind: "not-found";
    };

class InvalidRequestError extends Error {}

export class LifeOsHttpHandler {
  constructor(
    private readonly moduleRouter: ModuleRouter,
    private readonly inventoryCommandExecutor:
      InventoryCommandExecutor = {
        execute: async () => {
          throw new Error(
            "Inventory command executor is required",
          );
        },
      },
    private readonly executeInventoryText?: ExecuteInventoryText,
    private readonly queryInventoryText?: InventoryTextQueryExecutor,
    private readonly assistantService?: AssistantService,
    private readonly receiptAnalyzer?: ReceiptAnalyzer,
    private readonly executeReceiptInventory?: ExecuteReceiptInventory,
    private readonly resumeRunService?: ResumeRunService,
  ) {}

  async handle(
    request: HttpRequest,
  ): Promise<HttpResponse> {
    const method = request.method.toUpperCase();
    const route = this.matchRoute(request.url);

    if (route.kind === "not-found") {
      return this.json(404, {
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
        },
      });
    }

    if (route.kind === "health") {
      if (method !== "GET") {
        return this.methodNotAllowed();
      }

      return this.json(200, {
        status: "ok",
        service: "life-os",
      });
    }

    if (route.kind === "module") {
      if (method !== "GET") {
        return this.methodNotAllowed();
      }

      try {
        const result =
          await this.moduleRouter.route(
            route.request,
          );

        return this.json(
          200,
          this.toResponseBody(result),
        );
      } catch (error) {
        return this.handleError(error);
      }
    }
    if (route.kind === "assistant-text") {
      if (method !== "POST") {
        return this.methodNotAllowed();
      }

      if (!this.assistantService) {
        return this.json(500, {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Assistant service is not configured",
          },
        });
      }

      try {
        const body =
          this.parseJsonObject(
            request.body,
          );

        const result =
          await this.assistantService.handle({
            text:
              this.requireString(
                body,
                "text",
              ),
            workspaceId:
              route.workspaceId,
            householdId:
              this.requireString(
                body,
                "householdId",
              ),
            actorId:
              this.requireString(
                body,
                "actorId",
              ),
          });

        return this.json(200, {
          module: "assistant",
          action: "text",
          data: result,
        });
      } catch (error) {
        return this.handleError(error);
      }
    }

    if (route.kind === "inventory-text") {
  if (method !== "POST") {
    return this.methodNotAllowed();
  }

  if (!this.executeInventoryText) {
    return this.json(500, {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Inventory text executor is not configured",
      },
    });
  }

  try {
    const body =
      this.parseJsonObject(
        request.body,
      );

    const result =
      await this.executeInventoryText.execute({
        text:
          this.requireString(
            body,
            "text",
          ),
        workspaceId:
          route.workspaceId,
        householdId:
          this.requireString(
            body,
            "householdId",
          ),
        actorId:
          this.requireString(
            body,
            "actorId",
          ),
      });

    if (!result) {
      return this.json(400, {
        error: {
          code: "INVALID_REQUEST",
          message:
            "Could not resolve inventory text",
        },
      });
    }

    return this.json(200, {
      module: "inventory",
      action: "text_execute",
      data: result,
    });
  } catch (error) {
    return this.handleError(error);
  }
}
    if (route.kind === "inventory-query") {
      if (method !== "GET") {
        return this.methodNotAllowed();
      }

      if (!this.queryInventoryText) {
        return this.json(500, {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Inventory query executor is not configured",
          },
        });
      }

      const url =
        new URL(
          request.url,
          "http://localhost",
        );

      const text =
        url.searchParams.get("text");

      if (!text) {
        return this.json(400, {
          error: {
            code: "INVALID_REQUEST",
            message:
              "text query parameter is required",
          },
        });
      }

      const result =
        await this.queryInventoryText.execute({
          text,
          workspaceId:
            route.workspaceId,
        });

      if (!result) {
        return this.json(400, {
          error: {
            code: "INVALID_REQUEST",
            message:
              "Could not resolve inventory query",
          },
        });
      }

      return this.json(200, {
        module: "inventory",
        action: "query",
        data: result,
      });
    }


    if (route.kind === "resume-run-start") {
      if (method !== "POST") {
        return this.methodNotAllowed();
      }

      if (!this.resumeRunService) {
        return this.json(500, {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Resume run service is not configured",
          },
        });
      }

      try {
        const body = this.parseJsonBody(request.body);

        // Execution kind is chosen by APP_ENV inside the service; the request
        // cannot ask for replay or Claude.
        const run = this.resumeRunService.start({
          company: this.requireString(body, "company"),
          role: this.requireString(body, "role"),
          jdText: this.requireString(body, "jdText"),
        });

        return this.json(200, {
          module: "resume",
          action: "run_started",
          data: run,
        });
      } catch (error) {
        return this.handleError(error);
      }
    }

    if (route.kind === "resume-run-status") {
      if (method !== "GET") {
        return this.methodNotAllowed();
      }

      if (!this.resumeRunService) {
        return this.json(500, {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Resume run service is not configured",
          },
        });
      }

      const run = this.resumeRunService.get(route.runId);

      if (!run) {
        return this.json(404, {
          error: {
            code: "NOT_FOUND",
            message: "Resume run not found",
          },
        });
      }

      return this.json(200, {
        module: "resume",
        action: "run_status",
        data: run,
      });
    }

    if (route.kind === "receipt-analyze") {
      if (method !== "POST") {
        return this.methodNotAllowed();
      }

      if (!this.receiptAnalyzer) {
        return this.json(500, {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Receipt analyzer is not configured",
          },
        });
      }

      const body =
        this.parseJsonBody(request.body);

      const result =
        await this.receiptAnalyzer.analyze({
          imageBase64: this.requireString(
            body,
            "imageBase64",
          ),
          mimeType: this.requireString(
            body,
            "mimeType",
          ),
        });


      console.log(
        "RECEIPT EXECUTOR?",
        Boolean(this.executeReceiptInventory),
      );

      let inventorySaved = false;

      if (this.executeReceiptInventory) {
        try {
          await this.executeReceiptInventory.execute({
            items: result.items,
            workspaceId: route.workspaceId,
            householdId: this.requireString(
              body,
              "householdId",
            ),
            actorId: this.requireString(
              body,
              "actorId",
            ),
          });

          inventorySaved = true;
        } catch (error) {
          console.error(
            "RECEIPT INVENTORY SAVE FAILED",
            error,
          );
        }
      }

      return this.json(200, {
        module: "receipt",
        action: "analyzed",
        data: {
          ...result,
          inventorySaved,
        },
      });
    }


    if (method !== "POST") {
      return this.methodNotAllowed();
    }

    try {
      const command = this.parseInventoryCommand(
        request.body,
        route.workspaceId,
      );

      const result =
        await this.inventoryCommandExecutor.execute(
          command,
        );

      return this.json(200, {
        module: "inventory",
        action: "execute",
        data: result,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  private matchRoute(
    rawUrl: string,
  ): MatchedRoute {
    const url = new URL(
      rawUrl,
      "http://localhost",
    );

    if (url.pathname === "/health") {
      return {
        kind: "health",
      };
    }
    const resumeRunStatusMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/resume\/runs\/([^/]+)\/?$/,
    );

    if (resumeRunStatusMatch) {
      const workspaceId =
        this.decodeWorkspaceId(resumeRunStatusMatch[1]);

      return workspaceId === null
        ? {
            kind: "not-found",
          }
        : {
            kind: "resume-run-status",
            workspaceId,
            runId: decodeURIComponent(resumeRunStatusMatch[2] ?? ""),
          };
    }

    const resumeRunStartMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/resume\/runs\/?$/,
    );

    if (resumeRunStartMatch) {
      const workspaceId =
        this.decodeWorkspaceId(resumeRunStartMatch[1]);

      return workspaceId === null
        ? {
            kind: "not-found",
          }
        : {
            kind: "resume-run-start",
            workspaceId,
          };
    }

    const assistantTextMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/assistant\/text\/?$/,
    );

    if (assistantTextMatch) {
      const workspaceId =
        this.decodeWorkspaceId(assistantTextMatch[1]);

      return workspaceId === null
        ? {
            kind: "not-found",
          }
        : {
            kind: "assistant-text",
            workspaceId,
          };
    }

    const textMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/inventory\/text\/?$/,
    );

    if (textMatch) {
      const workspaceId =
        this.decodeWorkspaceId(textMatch[1]);

      return workspaceId === null
        ? {
            kind: "not-found",
          }
        : {
            kind: "inventory-text",
            workspaceId,
          };
    }

    const queryMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/inventory\/query\/?$/,
    );

    if (queryMatch) {
      const workspaceId =
        this.decodeWorkspaceId(queryMatch[1]);

      return workspaceId === null
        ? {
            kind: "not-found",
          }
        : {
            kind: "inventory-query",
            workspaceId,
          };
    }


    const receiptMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/receipt\/analyze\/?$/,
    );

    if (receiptMatch) {
      const workspaceId =
        this.decodeWorkspaceId(receiptMatch[1]);

      return workspaceId === null
        ? { kind: "not-found" }
        : {
            kind: "receipt-analyze",
            workspaceId,
          };
    }

    const commandMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/inventory\/commands\/?$/,
    );

    if (commandMatch) {
      const workspaceId =
        this.decodeWorkspaceId(commandMatch[1]);

      return workspaceId === null
        ? { kind: "not-found" }
        : {
            kind: "inventory-command",
            workspaceId,
          };
    }

    const moduleMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/(inventory|knowledge)\/?$/,
    );

    if (!moduleMatch) {
      return {
        kind: "not-found",
      };
    }

    const workspaceId =
      this.decodeWorkspaceId(moduleMatch[1]);

    const moduleName = moduleMatch[2];

    if (
      workspaceId === null
      || moduleName === undefined
    ) {
      return {
        kind: "not-found",
      };
    }

    if (moduleName === "inventory") {
      return {
        kind: "module",
        request: {
          module: "inventory",
          action: "list",
          workspaceId,
        },
      };
    }

    return {
      kind: "module",
      request: {
        module: "knowledge",
        action: "list",
        workspaceId,
      },
    };
  }

  private decodeWorkspaceId(
    encodedWorkspaceId: string | undefined,
  ): string | null {
    if (encodedWorkspaceId === undefined) {
      return null;
    }

    try {
      const workspaceId = decodeURIComponent(
        encodedWorkspaceId,
      );

      return workspaceId.trim().length === 0
        ? null
        : workspaceId;
    } catch {
      return null;
    }
  }

  private parseInventoryCommand(
    rawBody: string | undefined,
    routeWorkspaceId: string,
  ): InventoryCommand {
    if (
      rawBody === undefined
      || rawBody.trim().length === 0
    ) {
      throw new InvalidRequestError(
        "Request body is required",
      );
    }

    let value: unknown;

    try {
      value = JSON.parse(rawBody);
    } catch {
      throw new InvalidRequestError(
        "Request body must be valid JSON",
      );
    }

    if (!this.isRecord(value)) {
      throw new InvalidRequestError(
        "Request body must be an object",
      );
    }

    const type = value.type;

    if (
      type !== "PurchaseInventory"
      && type !== "ConsumeInventory"
    ) {
      throw new InvalidRequestError(
        "type must be PurchaseInventory or ConsumeInventory",
      );
    }

    const commandId =
      this.requireString(value, "commandId");

    const idempotencyKey =
      this.requireString(
        value,
        "idempotencyKey",
      );

    const correlationId =
      this.requireString(
        value,
        "correlationId",
      );

    const householdId =
      this.requireString(value, "householdId");

    const workspaceId =
      this.requireString(value, "workspaceId");

    const actorId =
      this.requireString(value, "actorId");

    if (workspaceId !== routeWorkspaceId) {
      throw new InvalidRequestError(
        "workspaceId must match the URL workspaceId",
      );
    }

    if (!Array.isArray(value.items)) {
      throw new InvalidRequestError(
        "items must be an array",
      );
    }

    if (value.items.length === 0) {
      throw new InvalidRequestError(
        "items must contain at least one item",
      );
    }

    const items = value.items.map(
      (item, index) =>
        this.parseInventoryLine(item, index),
    );

    return {
      type,
      commandId,
      idempotencyKey,
      correlationId,
      householdId,
      workspaceId,
      actorId,
      items,
    };
  }

  private parseInventoryLine(
    value: unknown,
    index: number,
  ): InventoryLine {
    if (!this.isRecord(value)) {
      throw new InvalidRequestError(
        `items[${index}] must be an object`,
      );
    }

    const quantity = value.quantity;

    if (
      typeof quantity !== "number"
      || !Number.isFinite(quantity)
      || quantity <= 0
    ) {
      throw new InvalidRequestError(
        `items[${index}].quantity must be a positive number`,
      );
    }

    return {
      canonicalProductId: this.requireString(
        value,
        "canonicalProductId",
        `items[${index}]`,
      ),
      canonicalName: this.requireString(
        value,
        "canonicalName",
        `items[${index}]`,
      ),
      quantity,
      unit: this.requireString(
        value,
        "unit",
        `items[${index}]`,
      ),
      rawName: this.requireString(
        value,
        "rawName",
        `items[${index}]`,
      ),
    };
  }

  private parseJsonBody(
    body?: string,
  ): Record<string, unknown> {
    if (!body) {
      throw new InvalidRequestError(
        "Request body is required",
      );
    }

    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw new InvalidRequestError(
        "Request body must be valid JSON",
      );
    }
  }

  private requireString(
    value: Record<string, unknown>,
    key: string,
    prefix?: string,
  ): string {
    const fieldValue = value[key];
    const fieldName = prefix
      ? `${prefix}.${key}`
      : key;

    if (
      typeof fieldValue !== "string"
      || fieldValue.trim().length === 0
    ) {
      throw new InvalidRequestError(
        `${fieldName} is required`,
      );
    }

    return fieldValue;
  }

  private parseJsonObject(
    rawBody: string | undefined,
  ): Record<string, unknown> {
    if (
      rawBody === undefined
      || rawBody.trim().length === 0
    ) {
      throw new InvalidRequestError(
        "Request body is required",
      );
    }

    let value: unknown;

    try {
      value = JSON.parse(rawBody);
    } catch {
      throw new InvalidRequestError(
        "Request body must be valid JSON",
      );
    }

    if (!this.isRecord(value)) {
      throw new InvalidRequestError(
        "Request body must be an object",
      );
    }

    return value;
  }

  private isRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      typeof value === "object"
      && value !== null
      && !Array.isArray(value)
    );
  }

  private toResponseBody(
    result: LifeOsModuleResult,
  ): object {
    return {
      module: result.module,
      action: result.action,
      data: result.data,
    };
  }

  private methodNotAllowed(): HttpResponse {
    return this.json(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      },
    });
  }

  private handleError(
    error: unknown,
  ): HttpResponse {
    console.error(error);

    if (
      error instanceof InvalidRequestError
      || (
        error instanceof Error
        && error.message.endsWith(
          "is required",
        )
      )
    ) {
      return this.json(400, {
        error: {
          code: "INVALID_REQUEST",
          message: error.message,
        },
      });
    }

    return this.json(500, {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }

  private json(
    statusCode: number,
    body: object,
  ): HttpResponse {
    return {
      statusCode,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    };
  }
}

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  LifeOsModuleRequest,
  LifeOsModuleResult,
} from "../src/application/life-os-module-router.js";
import type {
  ExecutedResult,
  InventoryCommand,
} from "../src/household-supplies/types.js";
import { LifeOsHttpHandler } from "../src/interfaces/http/life-os-http-handler.js";

function createRouter() {
  return {
    route: vi.fn<
      (
        request: LifeOsModuleRequest,
      ) => Promise<LifeOsModuleResult>
    >(),
  };
}

function createExecutor() {
  return {
    execute: vi.fn<
      (
        command: InventoryCommand,
      ) => Promise<ExecutedResult>
    >(),
  };
}

function createQueryExecutor() {
  return {
    execute: vi.fn()
      .mockResolvedValue([
        {
          canonicalName: "계란",
          quantity: 57,
          unit: "개",
        },
      ]),
  };
}

function createPurchaseCommand(
  workspaceId = "workspace-001",
): InventoryCommand {
  return {
    type: "PurchaseInventory",
    commandId: "command-001",
    idempotencyKey: "idempotency-001",
    correlationId: "correlation-001",
    householdId: "household-001",
    workspaceId,
    actorId: "actor-001",
    items: [
      {
        canonicalProductId: "product-egg",
        canonicalName: "계란",
        quantity: 30,
        unit: "개",
        rawName: "계란 한 판",
      },
    ],
  };
}

describe("LifeOsHttpHandler", () => {
  it("returns the health response", async () => {
    const router = createRouter();

    const handler =
      new LifeOsHttpHandler(router);

    const response = await handler.handle({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);

    expect(
      JSON.parse(response.body),
    ).toEqual({
      status: "ok",
      service: "life-os",
    });

    expect(router.route).not.toHaveBeenCalled();
  });

  it("routes inventory requests without duplicating application logic", async () => {
    const router = createRouter();

    router.route.mockResolvedValue({
      module: "inventory",
      action: "list",
      data: [],
    });

    const handler =
      new LifeOsHttpHandler(router);

    const response = await handler.handle({
      method: "GET",
      url:
        "/api/workspaces/workspace-001/inventory",
    });

    expect(response.statusCode).toBe(200);

    expect(router.route).toHaveBeenCalledWith({
      module: "inventory",
      action: "list",
      workspaceId: "workspace-001",
    });

    expect(
      JSON.parse(response.body),
    ).toEqual({
      module: "inventory",
      action: "list",
      data: [],
    });
  });

  it("routes knowledge requests through the existing router", async () => {
    const router = createRouter();

    router.route.mockResolvedValue({
      module: "knowledge",
      action: "list",
      data: [],
    });

    const handler =
      new LifeOsHttpHandler(router);

    const response = await handler.handle({
      method: "GET",
      url:
        "/api/workspaces/workspace-001/knowledge",
    });

    expect(response.statusCode).toBe(200);

    expect(router.route).toHaveBeenCalledWith({
      module: "knowledge",
      action: "list",
      workspaceId: "workspace-001",
    });
  });

  it("queries inventory through natural language query route", async () => {
    const router = createRouter();

    const queryInventoryText =
      createQueryExecutor();

    const handler =
      new LifeOsHttpHandler(
        router,
        undefined,
        undefined,
        queryInventoryText,
      );

    const response = await handler.handle({
      method: "GET",
      url:
        "/api/workspaces/workspace-001/inventory/query?text=%EA%B3%84%EB%9E%80",
    });

    expect(response.statusCode).toBe(200);

    expect(
      JSON.parse(response.body),
    ).toEqual({
      module: "inventory",
      action: "query",
      data: [
        {
          canonicalName: "계란",
          quantity: 57,
          unit: "개",
        },
      ],
    });

    expect(
      queryInventoryText.execute,
    ).toHaveBeenCalledWith({
      text: "계란",
      workspaceId: "workspace-001",
    });
  });


  it("returns 404 for an unknown route", async () => {
    const router = createRouter();

    const handler =
      new LifeOsHttpHandler(router);

    const response = await handler.handle({
      method: "GET",
      url: "/api/unknown",
    });

    expect(response.statusCode).toBe(404);

    expect(
      JSON.parse(response.body),
    ).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });

    expect(router.route).not.toHaveBeenCalled();
  });

  it("returns 405 for unsupported methods", async () => {
    const router = createRouter();

    const handler =
      new LifeOsHttpHandler(router);

    const response = await handler.handle({
      method: "POST",
      url:
        "/api/workspaces/workspace-001/inventory",
    });

    expect(response.statusCode).toBe(405);

    expect(router.route).not.toHaveBeenCalled();
  });

  it("does not expose internal errors", async () => {
    const router = createRouter();

    router.route.mockRejectedValue(
      new Error(
        "database password was rejected",
      ),
    );

    const handler =
      new LifeOsHttpHandler(router);

    const response = await handler.handle({
      method: "GET",
      url:
        "/api/workspaces/workspace-001/inventory",
    });

    expect(response.statusCode).toBe(500);

    expect(
      JSON.parse(response.body),
    ).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          "An unexpected error occurred",
      },
    });

    expect(response.body).not.toContain(
      "database password",
    );
  });
  it("executes an inventory purchase command", async () => {
    const router = createRouter();
    const executor = createExecutor();
    const command = createPurchaseCommand();

    const result: ExecutedResult = {
      status: "executed",
      intent: "purchase_inventory",
      eventId: "event-001",
      items: command.items,
    };

    executor.execute.mockResolvedValue(result);

    const handler =
      new LifeOsHttpHandler(
        router,
        executor,
      );

    const response = await handler.handle({
      method: "POST",
      url:
        "/api/workspaces/workspace-001/inventory/commands",
      body: JSON.stringify(command),
    });

    expect(response.statusCode).toBe(200);

    expect(executor.execute).toHaveBeenCalledWith(
      command,
    );

    expect(
      JSON.parse(response.body),
    ).toEqual({
      module: "inventory",
      action: "execute",
      data: result,
    });

    expect(router.route).not.toHaveBeenCalled();
  });

  it("rejects a workspaceId that does not match the URL", async () => {
    const router = createRouter();
    const executor = createExecutor();

    const handler =
      new LifeOsHttpHandler(
        router,
        executor,
      );

    const response = await handler.handle({
      method: "POST",
      url:
        "/api/workspaces/workspace-001/inventory/commands",
      body: JSON.stringify(
        createPurchaseCommand("workspace-002"),
      ),
    });

    expect(response.statusCode).toBe(400);

    expect(
      JSON.parse(response.body),
    ).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "workspaceId must match the URL workspaceId",
      },
    });

    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON for inventory commands", async () => {
    const router = createRouter();
    const executor = createExecutor();

    const handler =
      new LifeOsHttpHandler(
        router,
        executor,
      );

    const response = await handler.handle({
      method: "POST",
      url:
        "/api/workspaces/workspace-001/inventory/commands",
      body: "{invalid-json",
    });

    expect(response.statusCode).toBe(400);

    expect(
      JSON.parse(response.body),
    ).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message:
          "Request body must be valid JSON",
      },
    });

    expect(executor.execute).not.toHaveBeenCalled();
  });
});

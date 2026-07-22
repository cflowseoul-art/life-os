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
});

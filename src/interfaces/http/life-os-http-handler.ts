import type {
  LifeOsModuleRequest,
  LifeOsModuleResult,
  LifeOsModuleRouter,
} from "../../application/life-os-module-router.js";

export type HttpRequest = {
  method: string;
  url: string;
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

type MatchedRoute =
  | {
      kind: "health";
    }
  | {
      kind: "module";
      request: LifeOsModuleRequest;
    }
  | {
      kind: "not-found";
    };

export class LifeOsHttpHandler {
  constructor(
    private readonly moduleRouter: ModuleRouter,
  ) {}

  async handle(
    request: HttpRequest,
  ): Promise<HttpResponse> {
    const method = request.method.toUpperCase();

    if (method !== "GET") {
      return this.json(405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only GET is supported",
        },
      });
    }

    const route = this.matchRoute(request.url);

    if (route.kind === "health") {
      return this.json(200, {
        status: "ok",
        service: "life-os",
      });
    }

    if (route.kind === "not-found") {
      return this.json(404, {
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
        },
      });
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

    const match = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/(inventory|knowledge)\/?$/,
    );

    if (!match) {
      return {
        kind: "not-found",
      };
    }

    const encodedWorkspaceId = match[1];
    const moduleName = match[2];

    if (
      encodedWorkspaceId === undefined
      || moduleName === undefined
    ) {
      return {
        kind: "not-found",
      };
    }

    let workspaceId: string;

    try {
      workspaceId = decodeURIComponent(
        encodedWorkspaceId,
      );
    } catch {
      return {
        kind: "not-found",
      };
    }

    if (workspaceId.trim().length === 0) {
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

  private toResponseBody(
    result: LifeOsModuleResult,
  ): object {
    return {
      module: result.module,
      action: result.action,
      data: result.data,
    };
  }

  private handleError(
    error: unknown,
  ): HttpResponse {
    if (
      error instanceof Error
      && error.message.endsWith(
        "is required",
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

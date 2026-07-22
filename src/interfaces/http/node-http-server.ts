import {
  createServer,
  type Server,
} from "node:http";

import type {
  HttpRequest,
  LifeOsHttpHandler,
} from "./life-os-http-handler.js";

export type NodeHttpServerOptions = {
  host: string;
  port: number;
};

export async function startNodeHttpServer(
  handler: LifeOsHttpHandler,
  options: NodeHttpServerOptions,
): Promise<Server> {
  const server = createServer(
    async (request, response) => {
      const httpRequest: HttpRequest = {
        method: request.method ?? "GET",
        url: request.url ?? "/",
      };

      try {
        const result =
          await handler.handle(httpRequest);

        response.writeHead(
          result.statusCode,
          result.headers,
        );

        response.end(result.body);
      } catch {
        response.writeHead(500, {
          "content-type":
            "application/json; charset=utf-8",
        });

        response.end(
          JSON.stringify({
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message:
                "An unexpected error occurred",
            },
          }),
        );
      }
    },
  );

  await new Promise<void>(
    (resolve, reject) => {
      server.once("error", reject);

      server.listen(
        options.port,
        options.host,
        () => {
          server.off("error", reject);
          resolve();
        },
      );
    },
  );

  return server;
}

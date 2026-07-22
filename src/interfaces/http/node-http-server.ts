import {
  createServer,
  type IncomingMessage,
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

const maximumBodyBytes = 1_048_576;

async function readRequestBody(
  request: IncomingMessage,
): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    totalBytes += buffer.length;

    if (totalBytes > maximumBodyBytes) {
      throw new Error(
        "Request body exceeds maximum size",
      );
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function startNodeHttpServer(
  handler: LifeOsHttpHandler,
  options: NodeHttpServerOptions,
): Promise<Server> {
  const server = createServer(
    async (request, response) => {
      try {
        const body =
          await readRequestBody(request);

        const httpRequest: HttpRequest = {
          method: request.method ?? "GET",
          url: request.url ?? "/",
          ...(body === undefined
            ? {}
            : { body }),
        };

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

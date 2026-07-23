export type InventoryRoute =
  | "query"
  | "command";


export class InventoryIntentRouter {
  route(
    text: string,
  ): InventoryRoute {
    const normalized =
      text.trim();

    const commandKeywords = [
      "샀",
      "구매",
      "먹었",
      "먹음",
      "사용",
      "소비",
      "수정",
      "바꿔",
      "변경",
      "맞춰",
    ];

    const route =
      commandKeywords.some(
        (keyword) =>
          normalized.includes(keyword),
      )
        ? "command"
        : "query";

    console.log(
      "[INTENT_ROUTER]",
      {
        text,
        route,
      },
    );

    return route;
  }
}

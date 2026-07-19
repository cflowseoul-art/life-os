# Life OS Starter Context

This bundle is designed for Claude Code.

## Use

1. Copy all files into the root of your Life OS repository.
2. Start Claude Code from that repository.
3. Ask Claude to read `CLAUDE.md`.
4. Begin with:

```text
Read CLAUDE.md and the minimum relevant docs.
Do not code yet.
Review the repository and propose the smallest implementation plan for the first Inventory vertical slice.
List assumptions, affected files, and acceptance criteria.
```

## Token strategy

- Keep `CLAUDE.md` short and mandatory.
- Keep detailed context in `docs/`.
- Refer to document paths instead of pasting their contents.
- Tell Claude which plugin is affected.
- Use a fresh session for a new large task.
- Ask Claude to compact context after a completed milestone.
- Store durable decisions in `docs/decisions.md`, not chat history.
- Skills encode repeatable workflows; documentation encodes this project's facts and decisions.

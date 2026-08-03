/**
 * Asset's policy registry.
 *
 * Deliberately almost empty. The household has set no asset rules — no reserve,
 * no allocation target, no debt ratio — and inventing one would be Life OS
 * deciding something that is the representative's to decide (Art. 6).
 *
 * Only source-integrity checks live here: whether a snapshot is usable at all.
 */

import { defineRegistry } from "../../company/policy-engine.ts";
import type { AssetSnapshot } from "./snapshot.ts";
import { identity } from "./snapshot.ts";

export type AssetPolicyContext = {
  snapshots: AssetSnapshot[];
};

export const assetPolicies = defineRegistry<AssetPolicyContext>("asset");

assetPolicies.register({
  id: "snapshot-has-amount",
  title: "\uc794\uc561 \uae30\ub85d\uc5d0 \uae08\uc561\uc774 \uc788\uc5b4\uc57c \ud569\ub2c8\ub2e4",
  severity: "low",
  condition: (ctx) => ctx.snapshots.every((s) => Number.isFinite(s.amount)),
  evidence: (ctx) =>
    ctx.snapshots
      .filter((s) => !Number.isFinite(s.amount))
      .map((s) => ({ kind: "\uad00\ucc30" as const, text: `${s.name} \u00b7 ${s.asOf}`, rows: [] })),
  template: {
    state: (ctx) =>
      `\uae08\uc561\uc774 \ube44\uc5b4 \uc788\ub294 \uc794\uc561 \uae30\ub85d\uc774 ${String(ctx.snapshots.filter((s) => !Number.isFinite(s.amount)).length)}\uac74 \uc788\uc2b5\ub2c8\ub2e4.`,
    expected: "\uc794\uc561 \uae30\ub85d\uc5d0\ub294 \uae08\uc561\uc774 \uc788\uc5b4\uc57c \ud569\ub2c8\ub2e4.",
  },
});

assetPolicies.register({
  id: "snapshot-has-date",
  title: "\uc794\uc561 \uae30\ub85d\uc5d0 \uae30\ub85d\uc77c\uc774 \uc788\uc5b4\uc57c \ud569\ub2c8\ub2e4",
  severity: "low",
  condition: (ctx) => ctx.snapshots.every((s) => s.asOf.trim() !== ""),
  evidence: (ctx) =>
    ctx.snapshots
      .filter((s) => s.asOf.trim() === "")
      .map((s) => ({ kind: "\uad00\ucc30" as const, text: `${s.name} \u00b7 ${s.source}`, rows: [] })),
  template: {
    state: (ctx) =>
      `\uae30\ub85d\uc77c\uc774 \uc5c6\ub294 \uc794\uc561 \uae30\ub85d\uc774 ${String(ctx.snapshots.filter((s) => s.asOf.trim() === "").length)}\uac74 \uc788\uc2b5\ub2c8\ub2e4.`,
    expected: "\uc794\uc561 \uae30\ub85d\uc5d0\ub294 \uae30\ub85d\uc77c\uc774 \uc788\uc5b4\uc57c \ud569\ub2c8\ub2e4.",
  },
});

assetPolicies.register({
  id: "snapshot-identity-unique",
  title: "\uac19\uc740 \uacc4\uc88c\u00b7\uac19\uc740 \ub0a0\uc9dc\uc758 \uc794\uc561 \uae30\ub85d\uc740 \ud558\ub098\uc5ec\uc57c \ud569\ub2c8\ub2e4",
  severity: "low",
  condition: (ctx) => new Set(ctx.snapshots.map(identity)).size === ctx.snapshots.length,
  evidence: (ctx) => {
    const seen = new Set<string>();
    const duplicates: AssetSnapshot[] = [];

    for (const s of ctx.snapshots) {
      if (seen.has(identity(s))) duplicates.push(s);
      else seen.add(identity(s));
    }

    return duplicates.map((s) => ({
      kind: "\uad00\ucc30" as const,
      text: `${s.name} \u00b7 ${s.asOf} \u00b7 ${s.evidence}`,
      rows: [],
    }));
  },
  template: {
    state: (ctx) =>
      `\uc911\ubcf5\ub41c \uc794\uc561 \uae30\ub85d\uc774 ${String(ctx.snapshots.length - new Set(ctx.snapshots.map(identity)).size)}\uac74 \uc788\uc2b5\ub2c8\ub2e4.`,
    expected: "\uac19\uc740 \uacc4\uc88c\u00b7\uac19\uc740 \ub0a0\uc9dc\uc758 \uc794\uc561 \uae30\ub85d\uc740 \ud558\ub098\uc5ec\uc57c \ud569\ub2c8\ub2e4.",
  },
});

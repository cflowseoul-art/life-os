/**
 * The operating-policy engine.
 *
 * Company-wide infrastructure. Any department can state rules the
 * representative has set and have them checked the same way — Finance was the
 * first consumer, not the owner.
 *
 * The engine knows nothing about money, households, careers, or health. It
 * evaluates conditions over a context it never inspects, keeps only the rules
 * that are being broken, and orders them by severity. Everything
 * domain-specific lives in the policy the department wrote.
 *
 * Three properties are structural, not conventional:
 *   - a passing policy produces nothing at all (Art. 2)
 *   - a policy can state what *is* and what *should be*, and nothing else:
 *     there is no field for a remedy or an action (Art. 6)
 *   - evidence is required, so no finding can exist without something the
 *     representative can check (Art. 8)
 *
 * A department registers like this:
 *
 *     const homePolicies = defineRegistry<HomeContext>("home");
 *
 *     homePolicies.register({
 *       id: "staples-not-out",
 *       title: "상비 품목은 떨어지지 않게",
 *       severity: "medium",
 *       condition: (ctx) => ctx.staples.every((s) => s.onHand > 0),
 *       evidence: (ctx) =>
 *         ctx.staples.filter((s) => s.onHand === 0).map((s) => ({
 *           kind: "관찰", text: `${s.name} · 재고 0`, rows: [],
 *         })),
 *       template: {
 *         state: (ctx) => `상비 품목 ${count(ctx)}개가 떨어져 있습니다.`,
 *         expected: "상비 품목은 떨어지기 전에 채워져 있어야 합니다.",
 *       },
 *     });
 */

export type Severity = "low" | "medium" | "high";

/** A statement, and what kind of statement it is. */
export type Statement = {
  kind: "관찰" | "추론" | "제안";
  text: string;
  /** Source references — row numbers, ids, whatever the department can cite. */
  rows: number[];
};

/**
 * A policy is data.
 *
 * `condition` answers one question — does the rule hold? — and everything the
 * report says is built from `evidence` and `template`.
 */
export type PolicyDefinition<Context> = {
  id: string;
  /** The department accountable for the rule. */
  owner: string;
  title: string;
  severity: Severity;
  /** True when the representative's rule is being followed. */
  condition(context: Context): boolean;
  /** What demonstrates the current state. Required. */
  evidence(context: Context): Statement[];
  template: {
    /** What is currently the case. */
    state(context: Context): string;
    /** The rule, as the representative set it. */
    expected: string;
  };
};

export type PolicyResult<Context> = {
  policy: PolicyDefinition<Context>;
  passed: boolean;
  state: Statement;
  expected: string;
  evidence: Statement[];
};

const WEIGHT: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Evaluates policies against a context. Worst first. */
export function evaluate<Context>(
  policies: PolicyDefinition<Context>[],
  context: Context,
): PolicyResult<Context>[] {
  return policies
    .map((policy) => {
      const passed = policy.condition(context);
      const evidence = passed ? [] : policy.evidence(context);

      return {
        policy,
        passed,
        state: {
          kind: "관찰" as const,
          text: passed ? `${policy.title} — 정상입니다.` : policy.template.state(context),
          rows: evidence.flatMap((e) => e.rows),
        },
        expected: policy.template.expected,
        evidence,
      };
    })
    .sort((a, b) => WEIGHT[a.policy.severity] - WEIGHT[b.policy.severity]);
}

/** Only the rules that are not being followed. A kept rule is not news. */
export function violations<Context>(
  policies: PolicyDefinition<Context>[],
  context: Context,
): PolicyResult<Context>[] {
  return evaluate(policies, context).filter((r) => !r.passed);
}

/** Every owner that has registered a policy. For inspection, never for display. */
const OWNERS = new Set<string>();

export function registeredOwners(): string[] {
  return [...OWNERS].sort();
}

export type PolicyRegistry<Context> = {
  owner: string;
  register(policy: Omit<PolicyDefinition<Context>, "owner">): void;
  all(): PolicyDefinition<Context>[];
  /** Violations only, worst first. */
  evaluate(context: Context): PolicyResult<Context>[];
};

/**
 * A department's own registry.
 *
 * The context type is the department's business; the engine never looks inside
 * it. Registering twice with the same id replaces the earlier definition, so a
 * policy cannot silently exist in two versions.
 */
export function defineRegistry<Context>(owner: string): PolicyRegistry<Context> {
  const policies: PolicyDefinition<Context>[] = [];
  OWNERS.add(owner);

  return {
    owner,
    register(policy) {
      const definition = { ...policy, owner } as PolicyDefinition<Context>;
      const existing = policies.findIndex((p) => p.id === definition.id);

      if (existing === -1) policies.push(definition);
      else policies[existing] = definition;
    },
    all: () => [...policies],
    evaluate: (context) => violations(policies, context),
  };
}

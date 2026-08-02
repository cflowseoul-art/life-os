/**
 * The four surfaces, as a terminal. Handover, Ask, Ledger — and nothing else.
 *
 * Art. 13 (Interfaces): this is a surface, not an app. Held work is correct
 * whether or not anyone runs these commands; the commands only reveal it.
 *
 * Art. 2 (Silence): `ask` prints nothing when nothing needs the user. That
 * empty output is the product working, not a failure.
 *
 * Art. 16 (Naming): no run, job, mission, workflow, pipeline, or team appears
 * in any string below.
 */

import { readFileSync } from "node:fs";

import { CustodyEngine } from "./custody/engine.ts";
import { EventLog } from "./events/log.ts";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const engine = new CustodyEngine(new EventLog(process.env.LIFE_OS_LOG));
const command = process.argv[2];

switch (command) {
  case "hand-over": {
    const jdPath = arg("jd");

    const result = engine.handOver({
      company: arg("company") ?? "",
      role: arg("role") ?? "",
      jdText: jdPath ? readFileSync(jdPath, "utf8") : "",
    });

    if (!result.ok) {
      // Refusal is the only output here. Art. 3 — nothing was recorded.
      for (const reason of result.reasons) console.error(reason);
      process.exit(1);
    }

    // Art. 2: one line, because a handover the user just made is theirs to see
    // acknowledged. Nothing about progress follows.
    console.log("맡았습니다.");
    break;
  }

  case "ask": {
    const ask = engine.outstandingAsk();

    // Art. 1 + Art. 2: no ask, no output. Not "nothing to do" — nothing.
    if (!ask) break;

    console.log(ask.question);
    console.log();
    for (const fact of ask.facts) console.log(`  ${fact}`);
    console.log();
    for (const option of ask.options) {
      console.log(`  [${option.id}] ${option.label}`);
    }
    break;
  }

  case "answer": {
    const result = engine.answer(process.argv[3] ?? "");

    if (!result.ok) {
      console.error(result.reason);
      process.exit(1);
    }
    break;
  }

  case "ledger": {
    // Art. 11: read-only. This command has no side effects and offers no action.
    for (const hold of engine.ledger()) {
      console.log(`${hold.company} · ${hold.role} — ${hold.state}`);

      for (const observation of hold.observations) {
        console.log(`    · ${observation.statement}  (${observation.source})`);
      }

      if (hold.artifact) {
        console.log(`    ${hold.artifact.title}`);
        for (const section of hold.artifact.sections) {
          console.log(`      ${section.heading}  ← ${section.derivedFrom.join(", ")}`);
        }
      }

      if (hold.withdrawnReason) {
        console.log(`    철회: ${hold.withdrawnReason}`);
      }
    }
    break;
  }

  default:
    console.error("hand-over | ask | answer | ledger");
    process.exit(1);
}

/**
 * Work orders.
 *
 * A representative's instruction becomes a company work item *before* any
 * department runs. The order is what makes the work findable, accountable, and
 * survivable: it exists from the moment custody is acknowledged until the
 * report is filed.
 *
 * It is a projection over the events already recorded — no new event type, no
 * second store. A work order cannot drift from what happened, because it is
 * nothing but a reading of what happened (Art. 11).
 *
 * Lifecycle, in order:
 *   accepted   대표실이 접수했습니다        (HandedOver recorded)
 *   assigned   담당 부서와 담당자가 정해졌습니다  (capability on the event)
 *   working    담당자가 진행 중입니다        (representative answered an Ask)
 *   awaiting   대표님 결정을 기다립니다       (ask raised)
 *   completed  보고가 올라왔습니다          (artifact kept)
 *   withdrawn  거두어들였습니다            (hold withdrawn)
 *
 * `working` is deliberately **not** entered by recording a fact. Knowing
 * something is not the same as having started the work: a department may record
 * what it read and get no further, and reporting that as progress would tell the
 * representative something the record does not support. Until a real work-start
 * event exists, an order stays `assigned` until something actually moves it.
 */

import type { EventEnvelope } from "../events/types.ts";
import { employeeForResponsibility, signature } from "./employees.ts";
import { accountableForWork } from "./manifest.ts";
import type { ResponsibilityId } from "./responsibilities.ts";

/** Work always has an owner. A name the company does not recognise is an error. */
function accountableFor(capability: string): ResponsibilityId {
  const found = accountableForWork(capability);
  if (!found) throw new Error(`담당 책임을 찾을 수 없습니다: ${capability}`);
  return found;
}

export type WorkOrderState =
  | "accepted" | "assigned" | "working" | "awaiting" | "completed" | "withdrawn";

export type WorkOrderStep = {
  state: WorkOrderState;
  at: string;
  /** Who moved it — 대표님, an employee's display name, or the company. */
  by: string;
  note: string;
};

export type WorkOrder = {
  /** The hold this order tracks. One order, one piece of work. */
  id: string;
  /** What the representative asked for, in their words. */
  subject: string;
  /** The department accountable. Exactly one (§3). */
  department: string;
  /** The employee who signs the report. */
  assignee: { name: string; title: string; employeeId: string };
  state: WorkOrderState;
  acceptedAt: string;
  completedAt: string | null;
  history: WorkOrderStep[];
};

/** Intake is signed by whoever holds the CEO office, not by a fixed string. */
function acceptedBy(): string {
  const sign = signature("ceo.office");
  return `${sign.name} ${sign.title}`;
}

/**
 * Reads every work order out of the log.
 *
 * Deterministic assignment means the assignee needs no storage: the department
 * on the event decides who is accountable, and the roster decides the name.
 */
export function projectWorkOrders(events: EventEnvelope[]): WorkOrder[] {
  const orders = new Map<string, WorkOrder>();

  for (const envelope of events) {
    const { event } = envelope;

    if (event.type === "HandedOver") {
      const accountable = accountableFor(event.capability);
      const sign = signature(accountable);
      const employee = employeeForResponsibility(accountable);
      const subject = `${event.handover.company} · ${event.handover.role}`.replace(/ · $/, "");

      orders.set(event.holdId, {
        id: event.holdId,
        subject,
        department: event.capability,
        assignee: { name: sign.name, title: sign.title, employeeId: employee.id },
        state: "assigned",
        acceptedAt: envelope.at,
        completedAt: null,
        history: [
          { state: "accepted", at: envelope.at, by: acceptedBy(), note: "대표님 지시를 접수했습니다." },
          {
            state: "assigned",
            at: envelope.at,
            by: acceptedBy(),
            note: `${sign.displayDepartment} ${sign.name} ${sign.title}에게 맡겼습니다.`,
          },
        ],
      });
      continue;
    }

    const order = orders.get(event.holdId);
    if (!order) continue;

    const move = (state: WorkOrderState, by: string, note: string) => {
      order.state = state;
      order.history.push({ state, at: envelope.at, by, note });
    };

    if (event.type === "AskRaised") {
      move("awaiting", order.assignee.name, "대표님 결정을 여쭈었습니다.");
      continue;
    }

    if (event.type === "AskAnswered") {
      move("working", "대표님", "결정해 주셨습니다.");
      continue;
    }

    if (event.type === "ArtifactKept") {
      order.completedAt = envelope.at;
      move("completed", order.assignee.name, "보고를 올렸습니다.");
      continue;
    }

    if (event.type === "HoldWithdrawn") {
      move("withdrawn", "대표님", event.reason);
    }
  }

  return [...orders.values()];
}

export function workOrderFor(orders: WorkOrder[], holdId: string): WorkOrder | null {
  return orders.find((o) => o.id === holdId) ?? null;
}

/** Orders still in the company's hands. */
export function openOrders(orders: WorkOrder[]): WorkOrder[] {
  return orders.filter((o) => o.state !== "completed" && o.state !== "withdrawn");
}

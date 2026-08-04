/**
 * Who may sign in.
 *
 * A household is not a public product. `ALLOWED_GOOGLE_EMAILS` names the
 * accounts that may enter, and the list lives on the server only — it is never
 * sent to the browser, and there is no registration flow that could add to it.
 *
 * The list decides *entry*; Google's `sub` decides *identity* (an email can be
 * reassigned, a sub cannot).
 */

function entries(): string[] {
  return (process.env.ALLOWED_GOOGLE_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== "");
}

/** True when nobody is listed — the server refuses every sign-in in that case. */
export function allowlistEmpty(): boolean {
  return entries().length === 0;
}

export function isAllowed(email: string, verified: boolean): boolean {
  if (!verified) return false;

  const address = email.trim().toLowerCase();
  return address !== "" && entries().includes(address);
}

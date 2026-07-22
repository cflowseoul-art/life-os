// Kernel — Identity. CRUD entities (ADR-007); pure types only.

export type Role = "admin" | "member";

export type Household = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  displayName: string;
};

export type Membership = {
  householdId: string;
  userId: string;
  role: Role;
};

export type WorkspaceKind = "shared" | "personal";

export type Workspace = {
  id: string;
  householdId: string;
  name: string;
  kind: WorkspaceKind;
};

// Actor identity carried on every command and event (ADR-010 attribution).
export type Actor = {
  userId: string;
  householdId: string;
};

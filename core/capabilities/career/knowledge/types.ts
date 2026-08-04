/**
 * Career Knowledge — what Career permanently knows about the representative.
 *
 * Career owns this. Every Career employee reads it, and no Career employee may
 * ask the representative for something it already holds. That rule is why the
 * knowledge exists as a store rather than as something re-supplied per request.
 *
 * Two vocabularies live here and they are deliberately different sizes.
 *
 * `KnowledgeCategory` is the full list of things Career is *supposed* to know.
 * Every category exists, whether or not there is data behind it, because a
 * category with nothing in it is a **Gap** — and a gap has to be nameable to be
 * reported.
 *
 * The fact types are only the ones with real source data today. There is no
 * empty `resume` model waiting to be filled: Career does not hold a résumé, and
 * saying so is a gap, not a blank record.
 */

import type { KnowledgeFact } from "../../../events/types.ts";

/**
 * Everything Career is accountable for knowing.
 *
 * The list the department specification names, plus `interview_preparation`.
 * That one is separate on purpose: material prepared *for* interviews is not a
 * record *of* interviews, and folding it into `interview_history` would make
 * Career believe it knows about interviews the representative has never had.
 */
export type KnowledgeCategory =
  | "profile"
  | "career_history"
  | "projects"
  | "achievements"
  | "kpis"
  | "skills"
  | "resume"
  | "portfolio"
  | "interview_preparation"
  | "interview_history"
  | "application_history"
  | "recruiter_feedback"
  | "strengths"
  | "weaknesses"
  | "preferred_industries"
  | "preferred_roles";

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  "profile", "career_history", "projects", "achievements", "kpis", "skills",
  "resume", "portfolio", "interview_preparation", "interview_history",
  "application_history", "recruiter_feedback", "strengths", "weaknesses",
  "preferred_industries", "preferred_roles",
];

/** One field of who the representative is. */
export type ProfileFact = KnowledgeFact<"profile", { field: string; value: string }>;

/** A position held. */
export type EmploymentFact = KnowledgeFact<"employment", {
  employer: string;
  title: string;
  employmentType: string;
  period: string;
  domain: string;
  scope: string[];
  tools: string[];
}>;

/** A body of work inside a position, with what was actually done and its limits. */
export type ExperienceFact = KnowledgeFact<"experience", {
  title: string;
  employer: string;
  period: string;
  situation: string | null;
  evidence: string[];
  metrics: string[];
  result: string[];
  /** What this experience does **not** support. Carried so it cannot be lost. */
  limits: string;
}>;

export type ProjectFact = KnowledgeFact<"project", {
  title: string;
  employer: string;
  period: string;
  evidence: string[];
  metrics: string[];
  result: string;
  limits: string;
}>;

/** A verified outcome, stated exactly as it was verified. */
export type AchievementFact = KnowledgeFact<"achievement", { statement: string }>;

export type SkillFact = KnowledgeFact<"skill", {
  name: string;
  /** Experience ids that evidence it. A skill without evidence is not a skill. */
  evidence: string[];
  /** How far the evidence lets it be described. */
  safeWording: string;
}>;

/**
 * Something the representative may not claim.
 *
 * Recorded as knowledge because the absence is itself verified — it is the
 * result of checking, not of nobody having looked.
 */
export type ProhibitedClaimFact = KnowledgeFact<"prohibited_claim", { claim: string }>;

export type StrengthFact = KnowledgeFact<"strength", {
  statement: string;
  kind: "positioning" | "interview";
  /** Positioning angles are ranked; interview strengths are not. */
  rank: "primary" | "strong" | "secondary" | null;
}>;

export type WeaknessFact = KnowledgeFact<"weakness", { statement: string }>;

export type PreferredRoleFact = KnowledgeFact<"preferred_role", {
  role: string;
  kind: "target" | "positioning";
}>;

export type InterviewQuestionFact = KnowledgeFact<"interview_question", { question: string }>;

export type InterviewStoryFact = KnowledgeFact<"interview_story", {
  title: string;
  narrative: string;
}>;

/** Where an application stands. Ordered as a real process runs. */
export type ApplicationStatus =
  | "planned"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "planned", "applied", "screening", "interview", "offer", "rejected", "withdrawn",
];

/** How each status is said to the representative. */
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  planned: "지원 예정",
  applied: "지원함",
  screening: "서류 통과",
  interview: "면접 예정",
  offer: "오퍼",
  rejected: "탈락",
  withdrawn: "지원 철회",
};

/**
 * One application, and where it stands.
 *
 * Knowledge about the representative's search, not about the posting: the
 * posting is gone once applied to, and what remains is what happened. Nothing
 * here is a capability or a tool, so ADR-025 leaves this shape untouched.
 */
export type ApplicationFact = KnowledgeFact<"application", {
  company: string;
  position: string;
  status: ApplicationStatus;
  /** When the application was sent. Absent while still planned. */
  appliedAt: string | null;
  /** What happens next, in the representative's own terms. */
  nextStep: string | null;
  /** When an interview is scheduled, if one is. */
  interviewAt: string | null;
  /** 1 for a first interview, 2 for a second. Null outside the interview stage. */
  interviewStage: number | null;
  memo: string | null;
  updatedAt: string;
}>;

export type CareerKnowledgeFact =
  | ProfileFact
  | EmploymentFact
  | ExperienceFact
  | ProjectFact
  | AchievementFact
  | SkillFact
  | ProhibitedClaimFact
  | StrengthFact
  | WeaknessFact
  | PreferredRoleFact
  | InterviewQuestionFact
  | InterviewStoryFact
  | ApplicationFact;

export type CareerKnowledgeType = CareerKnowledgeFact["type"];

/** Which category a fact type answers for. One each. */
export const CATEGORY_OF: Record<CareerKnowledgeType, KnowledgeCategory> = {
  profile: "profile",
  employment: "career_history",
  experience: "career_history",
  project: "projects",
  achievement: "achievements",
  skill: "skills",
  prohibited_claim: "skills",
  strength: "strengths",
  weakness: "weaknesses",
  preferred_role: "preferred_roles",
  interview_question: "interview_preparation",
  interview_story: "interview_preparation",
  application: "application_history",
};

/**
 * Something Career does not know.
 *
 * A gap is a positive statement, not an absence: Career says what is missing
 * and why it is missing. That is what lets an employee report "I don't have
 * this" instead of inventing it or asking for something already held.
 */
export type Gap = {
  category: KnowledgeCategory;
  /** What is not known. */
  what: string;
  /** Why it is not known. Never "not implemented yet" — always about the record. */
  why: string;
};

/**
 * The seeded knowledge.
 *
 * Transcribed from the hand-verified source data the representative authored in
 * `prototypes/resume-tailoring/source-data/`. Every entry keeps the id it was
 * verified under — `ACH-001`, `SKL-004`, `EXP-002-E4` — so a claim made from
 * this knowledge can still be traced to the row that supports it.
 *
 * Nothing here is derived. No statement was summarised, combined, rounded, or
 * improved in transcription. Where the source records a limit — "인과관계 주장
 * 금지", "정량 오류 감소율 없음" — the limit is carried with the fact rather than
 * dropped, because a fact separated from its limits is how an experience becomes
 * an overstatement.
 *
 * The provenance is the same for every seeded entry, so it is stated once below.
 */

import type {
  CareerKnowledgeFact,
  Gap,
} from "./types.ts";
import type { Author } from "../../../events/types.ts";

/**
 * The representative verified this material themselves.
 *
 * Author is the representative, not the company: these are their claims about
 * their own career. Confidence is 1 because each row is a direct statement from
 * the source of record — which is what 1 means, not that the underlying claim
 * is objectively true.
 */
const AUTHOR: Author = { kind: "representative" };

/** When the source data was last verified by the representative. */
export const VERIFIED_AT = "2026-08-01T00:00:00.000Z";

/** Builds one seeded fact, so provenance cannot vary row to row. */
function fact<T extends CareerKnowledgeFact>(
  id: string,
  type: T["type"],
  value: T["value"],
  source: string,
): CareerKnowledgeFact {
  return {
    id,
    type,
    value,
    source: `career-knowledge:${source}`,
    author: AUTHOR,
    acquiredAt: VERIFIED_AT,
    confidence: 1,
  } as CareerKnowledgeFact;
}

const PROFILE = "profile.md";
const SKILLS = "skills.md";
const ACHIEVEMENTS = "achievements.md";
const POSITIONING = "positioning.md";

export const SEEDED_FACTS: CareerKnowledgeFact[] = [
  // ── Profile ─────────────────────────────────────────────────────────────
  fact("profile.target_role", "profile", { field: "목표 직무", value: "Data Analyst" }, PROFILE),
  fact("profile.positioning", "profile", { field: "핵심 포지셔닝", value: "Product Data Analyst" }, PROFILE),
  fact("profile.english", "profile", { field: "영어", value: "Conversational" }, PROFILE),
  fact("profile.summary", "profile", {
    field: "요약",
    value:
      "제품 문제를 데이터로 정의하고 이벤트 로그 설계부터 KPI, 실험, 리텐션, BI까지 수행한 Data Analyst. "
      + "사용자 행동 데이터와 제품 의사결정을 연결하는 역할을 수행했다.",
  }, PROFILE),

  // ── Career history ──────────────────────────────────────────────────────
  fact("EMP-001", "employment", {
    employer: "주식회사 트리노드",
    title: "Data Analyst",
    employmentType: "정규직",
    period: "2025.03–2026.02",
    domain: "모바일 게임",
    scope: [
      "신규 모바일 제품 분석 단독 담당",
      "이벤트 로그 설계, KPI 정의, 실험 설계, 리텐션 분석, BI 운영",
      "약 2주 단위 출시 사이클 대응",
    ],
    tools: ["SQL", "Tableau", "Python", "Databricks", "Firebase", "n8n", "Git"],
  }, PROFILE),

  fact("EXP-001", "experience", {
    title: "이벤트 로그 설계 및 데이터 품질 관리",
    employer: "EMP-001",
    period: "2025.03–2026.02",
    situation: "신규 모바일 제품의 약 2주 단위 출시 사이클에서 일관된 행동 분석을 위한 로그 규격과 QA가 필요했다.",
    evidence: [
      "EXP-001-E1: 이벤트명, 파라미터, 사용자 속성을 설계.",
      "EXP-001-E2: 이벤트 로그 규격 표준화.",
      "EXP-001-E3: 출시 전 플레이 QA 및 실시간 유입 확인.",
      "EXP-001-E4: 이상 데이터 원시 로그 역추적.",
      "EXP-001-E5: DE와 고빈도 이벤트 파티셔닝·안정성 협의.",
    ],
    metrics: [],
    result: [
      "EXP-001-R1: 신규 기능 추가 시 별도 구조 수정 없이 분석 가능한 기반 유지.",
      "EXP-001-R2: 로그 오류 조기 발견 절차 운영.",
    ],
    limits: "정량 오류 감소율 없음. DE 구현 자체를 담당했다고 표현 금지.",
  }, "experiences/EXP-001-event-logging.md"),

  fact("EXP-002", "experience", {
    title: "사용자 행동 기반 KPI 정의",
    employer: "EMP-001",
    period: "2025.03–2026.02",
    situation: "클리어율만으로 스테이지별 실패 경험 차이를 설명하기 어려웠다.",
    evidence: [
      "EXP-002-E1: 기존 KPI 한계 발견.",
      "EXP-002-E2: 실패 시 진행도를 활용한 '실패 시 진척도' 정의.",
      "EXP-002-E3: 개선 우선순위 도출.",
      "EXP-002-E4: Welch's t-test 사용.",
      "EXP-002-E5: n8n 이상 징후 알림 구성.",
    ],
    metrics: ["EXP-002-N1: p<0.05."],
    result: [
      "EXP-002-R1: 실패 경험 차이 정량화.",
      "EXP-002-R2: 개선 대상 우선순위 구체화.",
    ],
    limits: "매출·리텐션 직접 상승 주장 금지. 정확한 계산식 확인 필요.",
  }, "experiences/EXP-002-kpi.md"),

  fact("EXP-003", "experience", {
    title: "D3 Retention 영향 변수 분석",
    employer: "EMP-001",
    period: "2025.03–2026.02",
    situation: null,
    evidence: [
      "EXP-003-E1: D3 Retention을 목표 지표로 설정.",
      "EXP-003-E2: 초기 행동 변수 구성.",
      "EXP-003-E3: Logistic Regression 분석.",
      "EXP-003-E4: Decision Tree 분석.",
      "EXP-003-E5: UX 개선 후보 정리.",
    ],
    metrics: [],
    result: [
      "EXP-003-R1: 리텐션 관련 초기 행동 변수 식별.",
      "EXP-003-R2: 제품 개선 논의 근거 제공.",
    ],
    limits: "인과관계 주장 금지. AUC·정확도·표본 수 확인 안 됨. 운영 배포 경험 아님.",
  }, "experiences/EXP-003-retention.md"),

  fact("EXP-004", "experience", {
    title: "A/B Test 프로세스 개선",
    employer: "EMP-001",
    period: "2025.03–2026.02",
    situation: null,
    evidence: [
      "EXP-004-E1: 실험군·대조군 조건 정의.",
      "EXP-004-E2: 외생 변수 통제 기준 정리.",
      "EXP-004-E3: D3 Retention 주요 지표 사용.",
      "EXP-004-E4: 실패 시 진척도 롤백 가드레일 활용.",
      "EXP-004-E5: 마케팅과 유입 규모 협업.",
      "EXP-004-E6: Go/No-Go 판단 지원.",
    ],
    metrics: ["EXP-004-N1: 일 신규 약 350명.", "EXP-004-N2: D3 기준 약 100명."],
    result: ["실험 결과를 출시·롤백 판단과 연결하는 프로세스 정립."],
    limits: "성공률·상승 폭 확인 안 됨. 실험 플랫폼 개발 경험 아님.",
  }, "experiences/EXP-004-ab-test.md"),

  fact("EXP-005", "experience", {
    title: "Tableau 대시보드 및 BI 운영",
    employer: "EMP-001",
    period: "2025.03–2026.02",
    situation: null,
    evidence: [
      "EXP-005-E1: Tableau 대시보드 설계·구축.",
      "EXP-005-E2: 경영진·PO·운영용 정보 수준 구분.",
      "EXP-005-E3: RBAC 권한 체계 설계.",
      "EXP-005-E4: Live/Extract 및 리프레시 정책 운영.",
      "EXP-005-E5: Databricks 연동 운영.",
      "EXP-005-E6: 성능·비용 고려 운영 기준 수립.",
    ],
    metrics: ["EXP-005-N1: 대시보드 15개."],
    result: ["동일한 지표 정의 기반의 의사결정 환경과 BI 운영 체계 마련."],
    limits: "Tableau Server 전체 인프라 구축 주장 금지. 비용 절감 수치 없음.",
  }, "experiences/EXP-005-bi.md"),

  // ── Projects ────────────────────────────────────────────────────────────
  fact("PRJ-001", "project", {
    title: "LLM 자연어 질의용 데이터 모델링",
    employer: "EMP-001",
    period: "2025.03–2026.02",
    evidence: [
      "PRJ-001-E1: 자연어 질의용 분석 데이터 평탄화.",
      "PRJ-001-E2: 핵심 차원·지표 정리.",
      "PRJ-001-E3: 원천 구조를 숨기는 중간 모델 설계.",
      "PRJ-001-E4: 반복 조회 구조 개선.",
    ],
    metrics: ["PRJ-001-N1: 주 20시간.", "PRJ-001-N2: 주 5시간 미만.", "PRJ-001-N3: 약 75% 감축."],
    result: "반복 데이터 대응 시간을 주 20시간에서 5시간 미만으로 단축.",
    limits: "LLM 모델 개발·학습 주장 금지. 전체 서비스 아키텍처 단독 설계 주장 금지.",
  }, "projects/PRJ-001-llm-modeling.md"),

  // ── Achievements ────────────────────────────────────────────────────────
  ...[
    ["ACH-001", "Tableau 대시보드 15개 구축."],
    ["ACH-002", "반복 데이터 대응 시간 주 20시간 → 5시간 미만."],
    ["ACH-003", "위 개선 기준 약 75% 리드타임 감축."],
    ["ACH-004", "일 신규 사용자 약 350명 환경에서 D3 기준 약 100명 분석."],
    ["ACH-005", "Welch's t-test p<0.05 기준으로 신규 KPI 차이 검증."],
    ["ACH-006", "이벤트 로그 규격 표준화 및 출시 전후 QA 운영."],
    ["ACH-007", "D3 Retention 영향 변수 분석."],
    ["ACH-008", "A/B Test 외생 변수 통제 및 Go/No-Go 지원."],
  ].map(([id, statement]) => fact(id, "achievement", { statement }, ACHIEVEMENTS)),

  // ── Skills ──────────────────────────────────────────────────────────────
  ...[
    ["SKL-001", "SQL", ["EXP-001", "EXP-002", "EXP-003", "EXP-004", "EXP-005", "PRJ-001"], "실무 사용"],
    ["SKL-002", "Tableau", ["EXP-005"], "대시보드 구축·운영"],
    ["SKL-003", "Python", ["EXP-003", "EXP-004"], "분석·모델링"],
    ["SKL-004", "Databricks", ["EXP-001", "EXP-005", "PRJ-001"], "실무 사용"],
    ["SKL-005", "Firebase", ["EXP-001"], "이벤트 설계·검증"],
    ["SKL-006", "n8n", ["EXP-002"], "모니터링 알림"],
    ["SKL-007", "Git", ["EMP-001"], "협업 도구"],
    ["SKL-008", "Logistic Regression", ["EXP-003"], "리텐션 분석"],
    ["SKL-009", "Decision Tree", ["EXP-003"], "리텐션 분석"],
    ["SKL-010", "Welch's t-test", ["EXP-002"], "KPI 검증"],
    ["SKL-011", "A/B Test", ["EXP-004"], "실험 설계"],
    ["SKL-012", "RBAC", ["EXP-005"], "BI 권한 체계"],
    ["SKL-013", "Data Modeling", ["PRJ-001"], "LLM 질의용 모델링"],
  ].map(([id, name, evidence, safeWording]) =>
    fact(id as string, "skill", { name, evidence, safeWording }, SKILLS)),

  // ── What may not be claimed ─────────────────────────────────────────────
  ...[
    "Hex 실무 경험",
    "AWS 실무 경험",
    "ML Engineer 수준의 전문성",
    "Data Engineer로서 파이프라인 전체 구축",
    "대규모 분산처리 운영",
  ].map((claim, index) =>
    fact(`NCL-${String(index + 1).padStart(3, "0")}`, "prohibited_claim", { claim }, SKILLS)),

  // ── Strengths ───────────────────────────────────────────────────────────
  fact("POS-primary", "strength", {
    statement:
      "제품 문제를 데이터로 정의하고 로그 설계부터 KPI, 실험, 리텐션, BI까지 연결한 Product Data Analyst.",
    kind: "positioning",
    rank: "primary",
  }, POSITIONING),

  ...[
    "사용자 행동 분석", "이벤트 로그 및 데이터 품질", "KPI 설계", "리텐션 분석",
    "A/B Test", "Tableau 운영", "단독 오너십", "의사결정 지원",
  ].map((statement, index) =>
    fact(`POS-S${String(index + 1)}`, "strength", { statement, kind: "positioning", rank: "strong" }, POSITIONING)),

  ...["AI-ready 데이터 모델링", "RBAC·BI 거버넌스", "실시간 모니터링"].map((statement, index) =>
    fact(`POS-X${String(index + 1)}`, "strength", { statement, kind: "positioning", rank: "secondary" }, POSITIONING)),

  ...[
    "로그부터 의사결정까지 연결",
    "단독 분석 오너십",
    "KPI 한계 발견과 신규 지표 설계",
    "실험 가드레일과 Go/No-Go",
    "BI 운영·권한·비용 고려",
    "AI 활용을 위한 데이터 모델링",
  ].map((statement, index) =>
    fact(`STR-${String(index + 1)}`, "strength", { statement, kind: "interview", rank: null }, "interview/strengths.md")),

  // ── Weaknesses ──────────────────────────────────────────────────────────
  ...[
    "Hex 없음",
    "AWS 실무 확인 안 됨",
    "대규모 DE 운영 없음",
    "ML 운영 배포 없음",
    "요구 연차 3~7년 공고에서 연차 부족 가능",
  ].map((statement, index) =>
    fact(`WKN-${String(index + 1)}`, "weakness", { statement }, POSITIONING)),

  // ── Preferred roles ─────────────────────────────────────────────────────
  fact("ROLE-target", "preferred_role", { role: "Data Analyst", kind: "target" }, PROFILE),
  fact("ROLE-positioning", "preferred_role", { role: "Product Data Analyst", kind: "positioning" }, PROFILE),

  // ── Interview preparation ───────────────────────────────────────────────
  ...[
    "D3 Retention을 선택한 이유?",
    "실패 시 진척도 계산 방식과 검증?",
    "외생 변수는 무엇을 통제했나?",
    "표본 규모가 작은 상황에서 어떻게 판단했나?",
    "대시보드 15개의 사용자와 목적?",
    "Live와 Extract 선택 기준?",
    "RBAC 설계 방식?",
    "LLM 데이터 모델링에서 평탄화 기준?",
    "단독 담당자로서 개발자·PO와 협업한 방식?",
    "Hex 미경험을 어떻게 보완할 것인가?",
  ].map((question, index) =>
    fact(`IVQ-${String(index + 1).padStart(2, "0")}`, "interview_question", { question }, "interview/questions.md")),

  ...[
    ["Story 1 — KPI 한계 발견", "클리어율만으로 실패 경험을 설명하기 어려움 → 실패 시 진척도 정의 → Welch 검증 → 개선 우선순위."],
    ["Story 2 — 실험 체계", "외생 변수로 해석 어려움 → 통제 기준·D3·롤백 가드 → 마케팅 협업 → Go/No-Go 지원."],
    ["Story 3 — AI-ready 모델링", "반복 요청 주 20시간 → 평탄화 모델 → 5시간 미만 → 약 75% 감축."],
    ["Story 4 — BI 운영", "사용자별 요구 상이 → 15개 대시보드·RBAC·Live/Extract → 운영 체계."],
  ].map(([title, narrative], index) =>
    fact(`IVS-${String(index + 1)}`, "interview_story", { title, narrative }, "interview/stories.md")),
];

/**
 * What Career does not know, and why.
 *
 * Every gap is stated, never left as an empty list somebody has to notice. The
 * profile gaps come from the source's own "Needs confirmation" section — the
 * representative recorded what they had not confirmed, and that record is
 * knowledge too.
 */
export const SEEDED_GAPS: Gap[] = [
  { category: "profile", what: "이름", why: "출처에서 확인되지 않았습니다." },
  { category: "profile", what: "연락처 (이메일·전화·GitHub·LinkedIn)", why: "출처에서 확인되지 않았습니다." },
  { category: "profile", what: "거주 지역", why: "출처에서 확인되지 않았습니다." },
  { category: "profile", what: "정확한 법인명", why: "출처에서 확인되지 않았습니다." },
  { category: "profile", what: "팀명", why: "출처에서 확인되지 않았습니다." },
  { category: "profile", what: "퇴사 사유", why: "출처에서 확인되지 않았습니다." },
  { category: "profile", what: "총 경력 산정 기준", why: "출처에서 확인되지 않았습니다." },

  {
    category: "kpis",
    what: "정의한 KPI 자체의 기록",
    why: "KPI 관련 사실은 경력·프로젝트 안의 지표로만 남아 있고, 별도 기록은 없습니다.",
  },
  {
    category: "resume",
    what: "이력서",
    why: "이력서는 지식에서 생성되는 산출물이며, 원본으로 보관하지 않습니다.",
  },
  {
    category: "portfolio",
    what: "포트폴리오",
    why: "보관된 포트폴리오가 없습니다.",
  },
  {
    category: "interview_history",
    what: "실제로 진행한 면접 기록",
    why: "면접에 대비한 자료만 있고, 진행한 면접 기록은 없습니다.",
  },
  {
    category: "application_history",
    what: "지원 이력",
    why: "지원한 공고와 진행 상태를 기록한 적이 없습니다.",
  },
  {
    category: "recruiter_feedback",
    what: "리크루터 피드백",
    why: "받은 피드백이 기록된 적이 없습니다.",
  },
  {
    category: "preferred_industries",
    what: "선호 산업",
    why: "출처에는 공고 유형별 서술 방식만 있고, 선호 자체는 밝히신 적이 없습니다.",
  },
];

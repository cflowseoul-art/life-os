# 검증된 경력 인덱스

The context-economy device. This file exists to answer exactly one question, for
each experience, without opening it:

> **이 JD를 위해 이 파일을 열어야 하는가?**

Every field below earns its place by contributing to that decision. Anything that
does not is detail, and belongs in the detail file.

Copy to `source-data/INDEX.md` and replace the example rows.

## 항목

`EXP-` = 역할 수준 경험, `PRJ-` = 프로젝트. The load decision does not treat them
differently, so they share one table. The ID prefix carries the distinction.

| ID | 제목 | 기간 | 태그 | 파일 |
|---|---|---|---|---|
| EXP-001 | 결제 시스템 운영 | 2022.01 – 2024.08 | 결제, 운영, 장애대응 | `experiences/EXP-001-payment-ops.md` |
| EXP-002 | 신입 개발자 온보딩 리드 | 2023.03 – 2024.08 | 리딩, 멘토링 | `experiences/EXP-002-onboarding.md` |
| PRJ-001 | 결제 실패율 개선 | 2023.04 – 2023.09 | 결제, 성능 | `projects/PRJ-001-payment-failure.md` |
| PRJ-002 | 주문 API 리팩터링 | 2022.05 – 2022.11 | API, 리팩터링 | `projects/PRJ-002-order-api.md` |

### 필드

| 필드 | 로드 판단에 기여하는 방식 |
|---|---|
| ID | 인용 및 로드/스킵 기록. 상세 파일과의 유일한 연결 고리. |
| 제목 | 사람이 읽는 유일한 손잡이. 태그가 놓친 매칭을 보조. |
| 기간 | 최신성 판단, 그리고 "N년 이상" 유형 요건 대응. |
| 태그 | **1차 매칭 신호.** 아래 정규 어휘에서만 사용. |
| 파일 | 로드 주소. |

### 의도적으로 제외한 필드

Redundancy in an index is not free — a second copy of a fact is a second place
for it to drift, and here the duplicate would compete with an authoritative
source.

| 제외 | 이유 |
|---|---|
| 소속 (EMP) | 상세 파일의 `메타` 섹션에 있음. 로드 *후*에 필요한 정보이지 로드 판단에 필요한 정보가 아님. |
| 도구/기술 | `skills.md`가 기술별 증명 소스(EXP/PRJ ID)를 이미 역방향으로 매핑하고, 2단계는 `skills.md`를 항상 전문 로드함. 여기 중복하면 두 곳이 어긋난다. |
| 회사/직무/기간 (EMP 표) | `profile.md`가 전문 로드되며, 팩트체크 #4–#6의 기준이다. 인덱스가 두 번째 사본을 들면 어느 쪽이 맞는지 워크플로가 알 수 없다. |
| 기술 ID 범위 (SKL 표) | `skills.md`가 전문 로드되므로 로드 판단 자체가 발생하지 않는다. |
| 수치 여부 | 수치의 유무는 **관련성과 무관하다.** 수치 없는 항목이 필수 요건에 직접 대응할 수 있고, 수치 있는 항목이 이 JD와 아무 관련이 없을 수 있다. 로드 신호가 아니라 작성 단계의 재료이며, 상세 파일의 `수치` 섹션에 있다. |
| 재사용 플래그 | 아래 참조. |

## 로드 판단 규칙

**불확실하면 로드한다.**

The two errors are not symmetric. Loading an irrelevant file costs tokens.
Skipping a relevant one means a real qualification silently never reaches the
resume — and nothing downstream can detect the omission, because no stage ever
sees what was not loaded. Optimize for recall, not precision.

Soft ceiling: **10개 항목**. Beyond that, prioritize in this order:

1. 태그가 필수 요건과 일치
2. 태그가 우대 사항과 일치
3. 최근 항목

**관련성이 최신성보다 우선한다.** 오래된 항목이라도 필수 요건에 직접 대응하면,
최근이지만 관련 없는 항목보다 먼저 로드한다. 최신성은 관련성이 같을 때만
쓰는 마지막 기준이다.

Stage 2 records what it loaded and what it skipped, with a one-line reason. That
log is the only place a wrong skip becomes visible after the fact — read it.

### 재사용 플래그 — 도입하지 않음

"이 항목은 여러 JD에 두루 쓰인다"는 플래그를 검토했고, 채택하지 않는다.

- 관련성은 JD마다 달라지는 값인데, 플래그는 그것을 정적으로 고정한다.
- 실제로 여러 JD에 쓰이는 항목은 이미 넓은 태그를 갖고 있으므로, 태그가
  같은 일을 한다. 별도 필드는 중복이다.
- 플래그가 붙은 항목을 습관적으로 항상 로드하게 되고, 이는 이 인덱스가
  존재하는 이유 자체를 무력화한다.

태그가 이 역할을 못 한다는 증거가 실제 실행 기록에서 나오기 전에는 추가하지
않는다.

## 정규 태그 어휘 (Canonical tag vocabulary)

**이 목록이 태그의 유일한 정본이다.** 태그는 1차 매칭 신호이므로, 자유 태깅이
가장 큰 실패 지점이다: JD는 `결제`라고 쓰고 행은 `페이먼트`라고 쓰면, 파일은
영영 열리지 않고 아무도 오류를 보고하지 않는다.

Rules:

- A tag must come from this list, or be added to this list first.
- One concept, one tag. Do not maintain synonyms — add the synonym as a
  `→` alias instead so stage 2 can resolve JD vocabulary to your tag.
- 3–5 tags per row. More than that means the tags are too granular to
  discriminate.

Replace this vocabulary with your own domains.

| 태그 | 별칭 (JD에서 나타날 수 있는 표현) |
|---|---|
| 결제 | 페이먼트, PG, 정산 |
| 운영 | 유지보수, 안정화 |
| 장애대응 | 인시던트, 트러블슈팅, 온콜 |
| 성능 | 최적화, 응답속도, 처리량 |
| API | 인터페이스, 연동 |
| 리팩터링 | 구조개선, 레거시개선 |
| 리딩 | 팀리드, 주도 |
| 멘토링 | 온보딩, 교육 |

## 유지 규칙

- `experiences/`와 `projects/`의 **모든 파일은 여기 행이 있어야 한다.** 인덱스에
  없는 파일은 존재하지 않는 것과 같다 — 2단계는 이 파일만 보고 로드를 결정한다.
- 한 행은 한 줄. 두 줄이 필요하면 그 내용은 상세 파일에 속한다.
- 태그는 정규 어휘에서만. 새 태그가 필요하면 어휘 표에 먼저 추가한다.

## ID 규칙

- Assigned by you, stable, never reused.
- If an item is removed, retire its ID. Do not reassign it to something else, or
  citations in past runs silently point at the wrong thing.

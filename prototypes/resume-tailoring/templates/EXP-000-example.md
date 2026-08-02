# PRJ-001 결제 실패율 개선

Structure template for every file in `source-data/experiences/` and
`source-data/projects/` — both use this identical format. Only the ID prefix
differs (`EXP-` for role-level experience, `PRJ-` for projects).

Filename: `<ID>-<short-slug>.md` — e.g. `projects/PRJ-001-payment-failure.md`

The content below is sanitized example data. Replace all of it.

---

## 메타

- ID: PRJ-001
- 소속: EMP-001 ((주)예시테크)
- 기간: 2023.04 – 2023.09
- 역할: 백엔드 개발 담당 (팀 3명 중 1명)
- 태그: 결제, 성능, 수치있음

## 배경

PG사 연동 결제에서 실패율이 지속적으로 상승. 원인 미파악 상태로 CS 문의가
주당 40건 수준까지 증가.

## 한 일 (증거)

Each bullet gets a stable `-E<n>` sub-ID. One verifiable fact per bullet. If a
bullet contains two claims, split it — stage 5 verifies per bullet, and a mixed
bullet cannot be partially failed.

- PRJ-001-E1: 결제 요청 로그를 수집해 실패 유형을 6개로 분류하고, 그중 2개
  유형이 전체 실패의 78%를 차지함을 확인
- PRJ-001-E2: 타임아웃 재시도 로직을 지수 백오프 방식으로 재구현
- PRJ-001-E3: PG사 응답 지연 구간을 Redis 기반 서킷 브레이커로 차단
- PRJ-001-E4: 실패 유형별 대시보드를 구축해 운영팀이 직접 모니터링하도록 이관

## 수치 (증거)

Numbers get their own `-N<n>` sub-IDs so a metric is citable independently of the
sentence around it. Record how each was measured — the Fact Checker cannot
verify measurement method, but *you* will need it in an interview.

- PRJ-001-N1: 결제 실패율 3.2% → 0.8% (2023.09 기준, 월간 집계)
- PRJ-001-N2: 관련 CS 문의 주당 40건 → 9건 (2023.10 기준)
- PRJ-001-N3: 평균 결제 응답 시간 1.4초 → 0.9초 (P50, APM 측정)

## 사용 기술

Must match IDs in `skills.md`. A tool used here but missing from `skills.md`
cannot be written into a resume.

- SKL-001 (Java), SKL-002 (Spring Boot), SKL-022 (Redis), SKL-021 (PostgreSQL)

## 한계 및 주의

The honesty section. Records what you did *not* do, so the workflow cannot
overstate your role and so you are not ambushed in an interview.

- 서킷 브레이커 설계는 팀 리드가 주도, 본인은 구현 담당
- PG사 측 개선도 같은 기간에 있었으므로 수치 개선이 전적으로 본 작업의
  결과라고 단정할 수 없음
- 대시보드는 기존 Grafana 인프라 위에 구성, 인프라 구축 경험 아님

## 면접 대비 메모

Not used by the workflow. For you.

- 왜 지수 백오프였는가 → 고정 간격 재시도가 PG사 부하를 키우는 문제 확인
- 6개 실패 유형이 무엇이었는지 설명 가능해야 함

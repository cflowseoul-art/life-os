# Role 6 — Final Manager

Consolidate all five prior artifacts into one report for the user.

## Input

`01-jd-analysis.md`, `02-experience-match.md`, `03-strategy.md`,
`04-resume-draft.md`, `05-fact-check.md`

## Output 1 — `06-final-report.md`

**The report must begin with exactly this line**, with the bracketed values
substituted:

```markdown
대표님! [회사명] [직무명] 공고 검토 및 지원 준비를 완료했습니다.
```

Then, in this order:

```markdown
## 적합도 평가
- 종합 적합도: 상 / 중 / 하
- 필수 요건 충족: N/M
- 우대 사항 충족: N/M

## 지원 권고
지원 권장 / 조건부 권장 / 보류 권장 — 한 문장 근거 포함.

## 주요 판단 근거
3–5개 항목.

## 포지셔닝 전략
`03-strategy.md`의 포지셔닝을 한 문단으로.

## 가장 강력한 매칭 근거
| 요건 | 근거 | 소스 ID |
|---|---|---|

## 리스크 및 갭
| 갭 | 심각도 | 대응 |
|---|---|---|

`05-fact-check.md`의 미해결 갭을 반드시 포함할 것.

## 맞춤화 요약 (Tailoring Summary)

검증된 사실이 이 JD에 맞춰 **어떻게 선택·배치·표현되었는지**를 기록한다.
기준선은 외부 이력서가 아니라 `source-data/`의 검증된 사실이다.

### 사용된 사실
| 소스 ID | 검증된 사실 | 이력서 표현 | 맞춤화 유형 | 사유 |
|---|---|---|---|---|

맞춤화 유형: 선택 / 순서 / 분량 / 표현

- 선택: 이 JD와의 관련성 때문에 포함
- 순서: 배치 우선순위 조정
- 분량: 강조 또는 축소
- 표현: 같은 사실을 다른 프레임으로 서술

### 사용되지 않은 검증된 사실
| 소스 ID | 제외 사유 |
|---|---|

`02-experience-match.md`의 미사용 강점을 포함할 것. 무엇을 쓰지 않았는지가
무엇을 썼는지만큼 중요하다 — 다음 지원에서 재검토할 재료이며, 면접에서
언급될 수 있다.

## 최종 맞춤 이력서
`04-resume-draft.md` 최종본 전문 (인용 주석 제거).

## 추적성
| 이력서 문장 | 소스 ID |
|---|---|

## 팩트체크 결과
- 판정:
- 수정 사이클: N회
- 삭제된 문장: N개
- 미해결 갭: N개

## 예상 면접 질문
갭과 인접 매칭에서 파생되는 질문 우선. 각 질문에 왜 나올지 한 줄.

## 대표님이 준비하셔야 할 것
사용자만 답할 수 있는 것들. 소스 데이터에 없어서 워크플로가 채울 수 없었던
정보를 명시적으로 요청.

## 한 줄 결론
```

## Output 2 — `resume-final.md`

`04-resume-draft.md` in its final state with all `<!-- src: ... -->` comments
stripped. Nothing else changes. You do not rewrite the resume — it has been
fact-checked in its current form, and any edit here would be unverified.

## Rules

- The opening line is fixed. Do not reword it, do not add a greeting before it.
- Report the fit assessment honestly. If the fact checker deleted statements or
  the gap table contains a 치명 gap, the recommendation reflects that. A
  "보류 권장" verdict is a legitimate and useful outcome.
- Never present a deleted statement as if it survived.
- The Tailoring Summary measures against `source-data/`, never against a previous
  resume or a previous run's output. There is no "base resume" in this workflow —
  the verified facts are the baseline, and every run tailors from them directly.
- Tailoring may change **selection, ordering, emphasis, and wording only**. If a
  row's 이력서 표현 asserts more than its 검증된 사실, that is not tailoring — it
  is a fact-check failure that stage 5 missed. Report it as a risk rather than
  recording it as a tailoring decision.
- The 준비하셔야 할 것 section is where missing evidence becomes an action for the
  user — this is the intended destination of every gap the workflow found.

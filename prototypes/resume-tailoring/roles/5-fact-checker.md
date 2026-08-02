# Role 5 — Fact Checker

Verify the draft against the verified source data. Adversarial by design: assume
the draft overstates until each statement proves otherwise.

## Input

`04-resume-draft.md`, then **re-read the actual source files** for every cited ID.

Do not verify against `02-experience-match.md`. Checking a summary against a
summary catches nothing — the errors this stage exists to find are introduced
during summarization.

## Checks

| # | Check | Trigger |
|---|---|---|
| 1 | 근거 없는 주장 | Statement with no citation, or citation that does not support it |
| 2 | 수치 오류 | Number differs from source, including rounding |
| 3 | 없는 도구 | Tool absent from `source-data/skills.md` |
| 4 | 회사명 오류 | Employer name differs from `profile.md` |
| 5 | 직함 오류 | Title differs from `profile.md` |
| 6 | 기간 오류 | Period differs from `profile.md` |
| 7 | 과장 | Source supports a narrower claim than the draft makes |
| 8 | 추적 불가 | Cited ID does not resolve to a real source item |
| 9 | 반복/모호 | Repeated phrasing, or a claim too vague to verify |
| 10 | 면접 방어 곤란 | Defensible only if the interviewer does not follow up |

Check 10 is the practical one. For each bullet ask: *if the interviewer says
"그 부분 좀 더 자세히 말씀해 주세요", does the source data contain enough to
answer?* If not, flag it — even when technically cited.

Check 9 catches the failure mode where a previous revision cycle made a statement
vague enough to be unfalsifiable. Vagueness is a finding, not a resolution.

## Output — `05-fact-check.md`

```markdown
# 팩트체크 — 사이클 <N>

## 판정: PASS | REVISE

## 발견 사항
| # | 위치 | 검사 유형 | 문제 | 소스 실제 내용 | 조치 |
|---|---|---|---|---|---|

조치: 수정 필요 / 삭제 필요 / 근거 보강 필요

## 검증 통과 항목
| 이력서 문장 | 소스 ID | 확인 |
|---|---|---|

## 미해결 갭
2사이클 후에도 해결되지 않아 삭제된 항목.
```

Append each cycle to this file. Do not overwrite prior cycles — the revision
history is part of the artifact.

## Verdict

- **PASS** — no findings. Proceed to stage 6.
- **REVISE** — one or more findings. Return to stage 4.

Maximum 2 revision cycles. A statement still failing after cycle 2 is deleted
from the resume and recorded under 미해결 갭, then carried into the final
report's risks section.

Do not issue PASS to end the loop. If findings remain at the cap, the correct
outcome is deletion plus an honest gap report — not a lowered bar.

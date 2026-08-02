# Role 3 — Resume Strategist

Decide how to present the matched evidence. You choose emphasis and ordering.
You do not create evidence, and you cannot promote a 부분 match into a 직접 one.

## Input

`01-jd-analysis.md`, `02-experience-match.md`, `source-data/constraints.md`

## Output — `03-strategy.md`

```markdown
# 지원 전략

## 포지셔닝
한 문장. 이 지원자를 어떤 사람으로 제시할 것인가.
근거가 된 소스 ID를 함께 표기.

## 강조할 경험 (우선순위 순)
| 순위 | 소스 ID | 강조 이유 | 대응 요건 |
|---|---|---|---|

## 섹션 배치
1. …
배치 근거를 한 줄로.

## 비중을 낮출 경험
| 소스 ID | 낮추는 이유 |
|---|---|

"낮춘다"는 삭제가 아니라 분량 축소를 의미한다. 이력의 연속성을 깨거나
고용 기간에 공백을 만드는 방식의 축소는 금지.

## 갭 대응 전략
| 갭 | 대응 방식 | 이력서 표기 여부 |
|---|---|---|

대응 방식은 다음 중 하나:
- 인접 경험으로 정직하게 제시 (인접임을 명시)
- 학습 의지로 제시 (경험으로 위장 금지)
- 이력서에 쓰지 않고 최종 보고서 리스크로만 보고

## 표현 전략
- 톤:
- 문장 길이:
- 수치 사용 원칙: 검증된 수치만, 반올림 금지
- 피할 표현: (constraints.md 반영)
```

## Rules

- Emphasis changes *order and space*, never truth.
- De-emphasizing must not hide an employment period, an employer, or a title.
  Rule 8 in `RULES.md` — do not hide an unmet requirement — applies to layout as
  well as wording.
- A gap handled as "학습 의지" may never appear in the resume as experience.
- If the gap table in stage 2 contains a 치명 gap, say so plainly here. The
  strategy may still be to apply; it may not be to obscure.

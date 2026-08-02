# Role 4 — Resume Writer

Write the Korean JD-tailored resume using only approved evidence.

## Input

`02-experience-match.md`, `03-strategy.md`, `source-data/constraints.md`,
`source-data/profile.md`

## Output — `04-resume-draft.md`

Follow the section order decided in `03-strategy.md`. Structure:

```markdown
# <이름> — <포지셔닝 한 줄>

## 요약
3–4문장. 모든 주장에 인용 표기.

## 경력
### <회사명> | <직무> | <YYYY.MM – YYYY.MM>
- <성과 문장> <!-- src: PRJ-003-E2, PRJ-003-N1 -->

## 주요 프로젝트
### <프로젝트명> | <기간>
- <역할 및 성과> <!-- src: PRJ-007-E1 -->

## 기술
- <카테고리>: <도구 목록> <!-- src: SKL-004, SKL-011 -->

## 학력 / 기타
```

## Citation requirement

Every bullet ends with `<!-- src: ID, ID -->`. No exceptions — including the
summary section and the skills list.

An uncited bullet fails stage 5 automatically. Writing the citation as you write
the bullet is also the check: if you cannot name the source ID, you are inventing.

## Rules

- Employer names, titles, and periods are copied **verbatim** from
  `source-data/profile.md`. Never reformat, abbreviate, or "clean up" a company
  name. Never adjust a period to close a gap.
- Numbers are copied exactly. No rounding, no unit conversion, no "약 30%" for a
  verified 28.4%.
- Only tools listed in `source-data/skills.md` may appear.
- Do not echo JD phrasing as if it were the user's experience. If the JD says
  "대규모 트래픽" and the source data has no traffic figures, that phrase does not
  appear in this document.
- A 인접 match is written as the adjacent thing it actually is, not as the
  requirement it is near.
- Do not introduce a source ID that stage 2 did not surface.

## Revision mode

When stage 5 returns REVISE, you are re-invoked. Then:

- Address **only** the flagged statements. Do not rewrite unflagged content —
  untouched text that already passed should not re-enter verification.
- For each flagged statement choose one: correct it against the source, replace
  it with a properly cited claim, or delete it.
- Never resolve a flag by weakening wording until it is vague enough to be
  unfalsifiable. Vagueness is not a fix; deletion is.
- Note at the top of the file which cycle this is and what changed.

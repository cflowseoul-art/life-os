# Factual Safety Rules

Load this file at the start of every stage. No stage may skip it.

## Absolute prohibitions

The workflow must never:

1. Invent an experience.
2. Invent a number, metric, or performance result.
3. Claim use of a tool, language, or framework absent from `source-data/`.
4. Change an employer name.
5. Change an employment period.
6. Change a job title.
7. Copy JD wording mechanically and present it as the user's experience.
8. Hide an unmet requirement.
9. Turn an inference into a verified fact.
10. Derive a fact from anything other than `source-data/` — including a resume
    document, a prior run's output, or the JD itself.

Rule 7 is the subtle one. If the JD says "대규모 트래픽 처리 경험" and the source
data does not contain traffic figures, the resume may not contain the phrase
"대규모 트래픽 처리". Echoing JD vocabulary back is the most common way an
unsupported claim enters a tailored resume.

## Canonical source

`source-data/` is the canonical source of every fact. It is authored by the user
from primary evidence and lives in this repository. Everything else this workflow
touches is generated from it and is disposable.

```text
source-data/*.md  →  04-resume-draft.md  →  resume-final.md  →  .pdf / .docx
     canonical            generated            generated         generated
```

Provenance flows downstream only. The reverse is prohibited:

```text
✗  Resume (PDF/DOCX/Markdown)  →  source-data/
✗  prior run's output          →  source-data/
✗  JD                          →  source-data/
```

**No stage writes to `source-data/`.** If a needed fact is not already there, it
is a gap: report it and let the user add it. Never reconstruct one.

There is no "base resume" in this workflow. The verified facts are the baseline,
and every run tailors from them directly.

Two reasons this direction is absolute:

1. A resume is lossy in exactly the dimensions this workflow depends on. It
   carries polished claims but not evidence IDs, not the measurement method
   behind a number, and not the 한계 section recording what the user did *not*
   do. Reconstructing structured data from it means inventing that provenance,
   which is rule 9.
2. It would make stage 5 circular — verifying a resume against data that came
   from a resume. A fact checker whose source derives from the thing it checks
   cannot fail.

Corrections flow upstream: fix `source-data/` (user) or the workflow, then
regenerate. An edit made directly to a generated document is uncited, unverified,
and lost on the next run.

## Gap policy

When evidence is missing, label it as a gap. Never fill it.

A gap is not a failure of the workflow — it is the workflow working. Gaps are
reported to the user so they can decide whether to apply, and so they are not
ambushed by the question in an interview.

Never soften a gap into a near-claim. "관련 경험 없음" is acceptable output.
"유사한 환경에서의 경험 보유" — when the source data does not say so — is not.

## Traceability contract

Every statement in the tailored resume must trace to a source item.

### ID scheme

| Prefix | Meaning | Lives in |
|---|---|---|
| `EMP-001` | Employment record: employer, title, period | `source-data/profile.md` |
| `EXP-001` | Role-level experience | `source-data/experiences/` |
| `PRJ-001` | Project | `source-data/projects/` |
| `SKL-001` | Skill | `source-data/skills.md` |

Evidence bullets carry sub-IDs:

- `PRJ-003-E2` — the second evidence item of project 3
- `PRJ-003-N1` — the first number/metric of project 3

Numbers get their own IDs so a metric is citable independently of the sentence
around it. This is what makes "the claim is supported but the number is wrong"
a detectable condition.

IDs are assigned by the user, are stable, and are never reused.

### Citation format

In `04-resume-draft.md`, every bullet ends with an HTML comment:

```markdown
- 결제 실패율을 3.2%에서 0.8%로 개선 <!-- src: PRJ-003-E2, PRJ-003-N1 -->
```

Rules:

- A bullet with no citation is an automatic REVISE.
- A bullet citing an ID that does not resolve to a real source item is an
  automatic REVISE.
- A bullet whose citation resolves but does not actually support the claim is an
  automatic REVISE.

Citations survive into `06-final-report.md` as a traceability table. They are
stripped from `resume-final.md`, which is the only file meant to leave this
machine.

## Inference labeling

Some statements are reasonable but not directly stated in the source data.
These are permitted only when labeled, and only in analysis artifacts
(`02-experience-match.md`, `03-strategy.md`) — never in the resume itself.

Mark them `[추론]`. An unlabeled inference is a rule 9 violation.

## Precedence

These rules outrank every other instruction in this prototype, including any
strategy decision, any stylistic preference in `source-data/constraints.md`, and
any instruction to strengthen a weak-sounding resume. If a stage's own brief
appears to conflict with this file, this file wins.

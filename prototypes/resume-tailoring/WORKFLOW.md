# Workflow

One Claude Code session. One deterministic sequential pass. No subagents, no
parallel execution, no agent framework, no additional API calls.

## Canonical source

`source-data/` is the canonical source. Every other document this workflow
touches is generated from it and is disposable.

```text
source-data/*.md  →  04-resume-draft.md  →  resume-final.md  →  .pdf / .docx
     canonical            generated            generated         generated
```

The reverse direction is prohibited. This workflow **never** writes to
`source-data/`, and never derives a fact from a resume document, from a prior
run's output, or from the JD. If a needed fact is not already in `source-data/`,
it is a gap — report it and let the user add it themselves.

Deriving structured data from a resume would make stage 5 circular: it would
verify a resume against data that came from a resume. Provenance only ever flows
downstream.

## Preconditions

Stop and tell the user if any of these fail:

- `source-data/INDEX.md` exists and is non-empty.
- `inbox/jd.md` exists and contains a job description.

Also stop if `source-data/` still contains unmodified template content — the
example values `(주)예시테크`, `예시스타트업`, or `PRJ-001 결제 실패율 개선`.
The Fact Checker verifies *against* `source-data/`, not about it, so a run on
placeholder data would pass every check and produce a fact-checked resume for a
fictional person.

## Run directory

Derive from the JD:

```text
output/<YYYY-MM-DD>-<company>-<role>/
```

Slugify company and role: lowercase, spaces to hyphens, drop punctuation. If the
directory already exists, append `-2`, `-3`, and so on. Never overwrite a
previous run.

## Stage discipline

Each stage:

1. Loads `RULES.md` (already in context after the first stage).
2. Loads only its own role brief from `roles/`.
3. Loads only the inputs listed for it below.
4. Writes its artifact to disk **before** the next stage begins.

Do not read the next stage's role brief until the current artifact is written.
The file boundary is what makes the stage separation real rather than cosmetic.

Announce each stage to the user in one line as it starts, so the sequential
review is visible.

---

## Stage 1 — JD Analyst

**Brief:** `roles/1-jd-analyst.md`
**Reads:** `inbox/jd.md`
**Writes:** `01-jd-analysis.md`

Does not read `source-data/`. The JD must be analyzed on its own terms before any
experience is considered, or the analysis bends toward what the user happens to
have.

## Stage 2 — Experience Matcher

**Brief:** `roles/2-experience-matcher.md`
**Reads:** `01-jd-analysis.md`, then `source-data/INDEX.md`, then **only** the
detail files whose IDs plausibly match a JD requirement.
**Writes:** `02-experience-match.md`

This is the context-economy stage. Read the index first, decide which detail
files are relevant, then load only those. Do not read every file in
`source-data/experiences/` and `source-data/projects/`.

Also read `source-data/profile.md` and `source-data/skills.md` in full — both are
small and both are needed for employer/title/period and tool verification.

## Stage 3 — Resume Strategist

**Brief:** `roles/3-strategist.md`
**Reads:** `01-jd-analysis.md`, `02-experience-match.md`,
`source-data/constraints.md`
**Writes:** `03-strategy.md`

## Stage 4 — Resume Writer

**Brief:** `roles/4-writer.md`
**Reads:** `02-experience-match.md`, `03-strategy.md`,
`source-data/constraints.md`, `source-data/profile.md`
**Writes:** `04-resume-draft.md`

May use only evidence approved in stage 2 and selected in stage 3. May not
introduce a source ID that stage 2 did not surface.

## Stage 5 — Fact Checker

**Brief:** `roles/5-fact-checker.md`
**Reads:** `04-resume-draft.md`, then **re-reads the actual source files** for
every cited ID.
**Writes:** `05-fact-check.md`

Re-reading source files is the point of this stage. Do not verify against
`02-experience-match.md` — verifying a summary against a summary catches nothing.

Emits a verdict: `PASS` or `REVISE`.

### Revision loop

```text
Stage 5 verdict = REVISE
  → Stage 4 revises the draft, addressing only the flagged statements
  → Stage 5 re-checks
  → maximum 2 revision cycles
```

If a statement still fails after cycle 2, **delete it**, record it in
`05-fact-check.md` as an unresolved gap, and carry it into the final report's
risks section. Never soften it into a weaker claim to make it pass.

The cap is the termination rule. "Revise until it passes" has no guaranteed end
and creates exactly the pressure that produces a quietly weakened claim instead
of an honest gap.

Append each cycle to `05-fact-check.md`; do not overwrite prior cycles. The
revision history is part of the artifact.

## Stage 6 — Final Manager

**Brief:** `roles/6-final-manager.md`
**Reads:** all five prior artifacts
**Writes:** `06-final-report.md` and `resume-final.md`

`resume-final.md` is `04-resume-draft.md` in its final state with all `<!-- src:
... -->` comments stripped. Nothing else changes — the manager does not rewrite
the resume.

`resume-final.md` is the last artifact this workflow produces. It is a generated
document, not a source.

---

## Document generation (outside this workflow)

PDF and DOCX are generated from `resume-final.md` by the user, with an external
converter. This workflow does not generate them — it adds no dependencies.

Generated documents live in the run directory, are gitignored, and are
disposable. They are never inputs: do not read a PDF or DOCX to recover facts,
and do not treat a previously generated resume as evidence in a later run.

If a generated document is wrong, the fix goes upstream — into `source-data/` by
the user, or into this workflow — and the document is regenerated. An edit made
directly to a generated file is uncited, unverified, and lost on the next run.

---

## Completion

Report to the user:

- the run directory path
- the fact-check verdict and how many revision cycles ran
- the number of unresolved gaps
- the one-line conclusion from the final report

Do not claim a production Resume Plugin exists.

# Resume Tailoring Prototype

An isolated Claude Code experiment for validating a JD-tailored resume workflow.

## What this is

A deterministic, sequential Markdown workflow. You register verified career facts
once, paste one job description, run one command, and receive separated analysis
artifacts plus a final report.

## Canonical source and data flow

**The canonical source is the verified structured Markdown in `source-data/`.**
It lives in this repository. Nothing outside it is authoritative.

A resume — Markdown, PDF, or DOCX — is a **generated artifact**, downstream and
disposable. It can always be regenerated from the canonical facts; the canonical
facts can never be recovered from it.

```text
source-data/*.md           canonical — hand-verified, authored here
        ↓
04-resume-draft.md         tailored to one JD, every line cited
        ↓
resume-final.md            citations stripped, paste-ready
        ↓
resume-final.pdf / .docx   generated document — disposable
```

The reverse direction is prohibited:

```text
✗  Resume (PDF/DOCX/Markdown)  →  source-data/
```

Never import, parse, or back-fill `source-data/` from a resume document.

The reason is that a resume is lossy in exactly the dimensions this workflow
depends on. It carries polished claims but not their evidence, not the source IDs
that make them checkable, not the measurement method behind a number, and not the
한계 section recording what you did *not* do. Reconstructing structured data from
it would mean inventing that missing provenance — which is rule 9 in `RULES.md`,
turning an inference into a verified fact. It would also make the Fact Checker
circular: it would be verifying a resume against data derived from a resume.

**Corrections flow upstream.** If a generated document is wrong, fix
`source-data/` or the workflow and regenerate. Never edit a PDF, DOCX, or
`resume-final.md` directly — such an edit is uncited, unverified, and lost on the
next run.

## What this is NOT

- **Not** a production Resume Plugin. `docs/04-mvp.md` defers Resume, Finance,
  Travel, and Relationship until the Household Supplies slice proves the core
  architecture. That deferral still stands.
- **Not** a bounded context. Nothing here is registered in
  `src/application/life-os-module-router.ts`.
- **Not** event-sourced. No commands, no events, no projections, no database.
- **Not** a multi-agent system. `docs/LIFE_OS_SPEC.md` §8 defers the Agent layer
  and §10 lists an initial multi-agent system as a non-goal. The six "roles" here
  are sequential prompt stages in one session — no agent runtime, no subagents,
  no parallel execution, no extra API calls.

## Boundary

This directory sits outside `src/`, `database/`, `frontend/`, and `test/`.
`tsconfig.json` includes only `src` and `test`; `vitest.config.ts` includes only
`test/**/*.test.ts`. Nothing here is compiled, typechecked, tested, or executed by
the application. See ADR-019 in `docs/decisions.md`.

The AI writes Markdown files here. That does not violate the "AI never writes
directly to storage" rule in `CLAUDE.md`, because these files are not Life OS
storage and no household state is mutated. This prototype has no `householdId`,
no `workspaceId`, and no `actorId` — which is precisely why it cannot be lifted
into `src/` as-is.

## First-time setup

```bash
cp templates/INDEX.md        source-data/INDEX.md
cp templates/profile.md      source-data/profile.md
cp templates/skills.md       source-data/skills.md
cp templates/constraints.md  source-data/constraints.md
mkdir -p source-data/experiences source-data/projects
```

Then replace the sanitized example content with your real verified data. Use
`templates/EXP-000-example.md` as the structure for every file in
`source-data/experiences/` and `source-data/projects/`.

**Author these files directly.** Each fact is written from primary evidence —
what you actually did, the real numbers and how they were measured, the tools you
actually used, and the honest limits of your role. Do not populate `source-data/`
by handing a resume to Claude and asking for it to be restructured.

An existing resume may be used as a *memory aid* — to remind you which projects
to write up. That is different from treating it as the source. Every fact it
prompts must still be re-verified against primary evidence and recorded with its
own evidence bullets, numbers, and limits. Its wording never carries over.

`source-data/`, `inbox/`, and `output/` are gitignored. Your career data, any
pasted JD, and all generated documents never enter git history. They also have no
version history — back up `source-data/` yourself. It is the canonical source,
and it is the only thing here that cannot be regenerated.

## Each run

1. Update `source-data/` if anything changed. This is the only step that edits
   canonical data.
2. Paste one job description into `inbox/jd.md`.
3. Run `/tailor-resume`.
4. Read `output/<date>-<company>-<role>/06-final-report.md`.
   The paste-ready resume is `resume-final.md` in the same directory.
5. Optionally generate a submission document from `resume-final.md`:

   ```bash
   pandoc resume-final.md -o resume-final.pdf    # or .docx
   ```

   The workflow does not do this — it adds no dependencies. Use whatever
   converter you prefer. The generated file belongs in the run directory, is
   gitignored, and is disposable: regenerate it rather than editing it.

## Files

| Path | Purpose |
|---|---|
| `WORKFLOW.md` | The 6-stage sequence, gates, and revision loop. |
| `RULES.md` | Factual-safety rules and the traceability contract. |
| `roles/` | One brief per stage, loaded one at a time. |
| `templates/` | Sanitized starting points for `source-data/`. |
| `source-data/` | **Canonical.** Your verified career facts. Authored here, never imported. |
| `inbox/jd.md` | The job description for the current run. Input, not a source of facts. |
| `output/` | One directory per run, seven artifacts each. All generated, all disposable. |

# JD archive format — change note

Changes only how a displaced `inbox/jd.md` is archived. Input path, stage contracts, resume
generation, and `source-data/` are untouched. Nothing was run to verify.

## Changed file

`.claude/commands/tailor-resume.md` — §0 Materialization, step 1 only.

This is the sole place the archive rule was written. `WORKFLOW.md`, `README.md`, and
`RULES.md` contain no archive references (checked by grep), so no other documentation needed
updating.

## Before

```
inbox/archive/<YYYY-MM-DD-HHMM>-jd.md
```

A single flat file. No company, role, provenance, or output linkage — the timestamp was the
only identifying information.

## After

```
inbox/archive/<YYYY-MM-DD>_<company-slug>_<role-slug>/
├── jd.md          verbatim copy of the outgoing inbox/jd.md
└── metadata.md
```

`metadata.md` fields, one per line:

```markdown
- company:     <company or unknown>
- role:        <role or unknown>
- sourceUrl:   <url, or n/a if not provided>
- archivedAt:  <YYYY-MM-DD HH:MM>
- inputMode:   pasted | url | file
- outputDir:   <output/<dir> if known, else unknown>
```

## Rules specified

- **Slugs describe the outgoing JD**, not the incoming one — the archive records what is being
  displaced. Lowercased, spaces and `/` → `-`, non-alphanumerics dropped, Korean kept as-is.
  `unknown` when the company or role is not determinable from the outgoing file.
- **Collision handling:** never overwrite an existing archive directory. Append `-2`, `-3`, …
  until the name is free. Two archives of the same company+role on the same day therefore
  coexist rather than clobber.
- **`inputMode` and `sourceUrl` are read from the outgoing file's provenance line**
  (`<!-- source: … | url: … -->`), which §0 already writes. `source: paste` → `pasted`,
  `source: url` → `url`, absent → `file`. This is why the format works without new plumbing:
  the data was already being written into every materialized JD.
- **`archivedAt` keeps HH:MM** even though the directory name is date-only. Minute precision
  was the old format's only disambiguator; it survives inside the metadata while the
  collision suffix handles uniqueness in the path.

## Unchanged, deliberately

- `/tailor-resume` still reads `inbox/jd.md`, and stage 1's contract is untouched.
- Fallback mode still writes nothing and archives nothing — the file *is* the input.
- Archiving still triggers only when `inbox/jd.md` is non-empty **and differs** from the
  resolved JD.
- No `output/` file is moved or modified; `outputDir` is a recorded pointer only.
- `source-data/` untouched.

## Future Improvements

Recorded only, not acted on.

1. **One pre-existing archive file is in the old format:**
   `inbox/archive/2026-08-01-2015-jd.md`. It was not migrated — this task changed the format,
   not existing data. Converting it would require inferring company/role from its contents.
2. **`outputDir` will usually be `unknown` in practice.** At §0 time the outgoing JD's run
   directory is not tracked anywhere, so the field is only fillable when the same session
   produced it. Making it reliable needs a back-pointer written into `output/<dir>/` at run
   time — a change to the output side, which this task excluded.
3. §3's validation report line (§"naming the input mode used and the archive path if one was
   written") still reads correctly, since a directory path is still a path. Worth a wording
   pass if the distinction ever matters.

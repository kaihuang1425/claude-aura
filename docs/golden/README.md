# Golden images

Approved renders live here, one folder per theme id, named exactly like the
`dist/verify/` output they approve (e.g. `japanese-idol/japanese-idol-light-1440x900.png`).

- A golden is created ONLY from a user approval at a HUMAN CHECKPOINT: copy
  the approved `dist/verify/` render here unchanged, then add a line to
  `REFERENCE_LOCK.md` (created on first approval): relative path, SHA-256,
  native dimensions, approval date.
- `npm run verify:cycle` diffs every current render against its golden when
  one exists, and fails on drift (mean channel delta > 3/255 or > 2% of
  pixels changed by more than 10/255).
- Never overwrite a golden. A deliberate visual change replaces the golden as
  a NEW approval: new file, new REFERENCE_LOCK line marking the old one
  superseded, user sign-off recorded in docs/PROGRESS.md.
- Every approved golden must also be added to `docs/FILE_MANIFEST.md` (the
  manifest test fails otherwise — that failure is the reminder).

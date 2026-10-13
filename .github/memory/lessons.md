# Lessons

## 2026-10-13 — Check repository secrets before asking

- **Mistake:** Checked workspace `.env.secrets`, but asked for preview credentials without checking repository-local `.env.secrets`.
- **Correction:** Check `.env.secrets` first.
- **Rule:** Before asking for test credentials, inspect key names in both workspace and repository-local `.env.secrets`; never print values.

## 2026-09-30 — Secret paths

- **Mistake:** Documented an absolute local path for the workspace secrets file.
- **Correction:** Use `.env.secrets` relative to workspace root, or describe locating it without machine-specific paths.
- **Rule:** Never commit machine-specific absolute paths; document workspace-relative names only.

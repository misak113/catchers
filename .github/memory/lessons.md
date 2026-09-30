# Lessons

## 2026-09-30 — Secret paths

- **Mistake:** Documented an absolute local path for the workspace secrets file.
- **Correction:** Use `.env.secrets` relative to workspace root, or describe locating it without machine-specific paths.
- **Rule:** Never commit machine-specific absolute paths; document workspace-relative names only.

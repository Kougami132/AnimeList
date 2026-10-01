## Agent skills

### Issue tracker

Issues are tracked locally as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles mapped 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.

### Coding standards

Rules for architecture boundaries, Obsidian platform constraints, persistence, UI, styles, and testing live in `CODING_STANDARDS.md`. Consult before adding or editing code.

## Commit log 风格

- 提交信息沿用现有风格：`type: 中文摘要`。
- `type` 使用英文 Conventional Commit 前缀，例如 `feat`、`fix`、`chore`、`docs`、`test`、`refactor`。
- 冒号后的摘要使用中文，简短说明本次变更。
- **提交前确认**：提交前向用户展示变更文件清单与提交信息，明确请求确认；仅在用户明确同意后执行提交，绝不未经确认主动提交。


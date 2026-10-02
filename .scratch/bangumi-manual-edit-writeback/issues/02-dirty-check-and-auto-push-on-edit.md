# 02: Dirty Check and Automatic Push on Edit

**What to build:** Automatic triggering of the Bangumi push when saving changes in the anime note edit modal. The system compares previous frontmatter values against newly submitted values for progress, status, and score. If at least one of these values changed, local file changes are saved first, and then the updated values are pushed to Bangumi. If network errors occur, the local note remains safely persisted and an error notice is displayed. If no progress, status, or score changes occurred (e.g. only title or tags changed), no network requests are sent.

**Blocked by:** 01: Bangumi Client Upsert and Single Note Push Core

**Status:** ready-for-agent

- [x] Perform dirty checking before pushing during note edit, comparing previous `progress`, `status`, and `score` with submitted values
- [x] Skip Bangumi network calls entirely when only non-progress/status/score fields (such as title, tags, or completion note) are changed
- [x] Guarantee local note persistence precedence: frontmatter is saved to the vault before dispatching the push request
- [x] Ensure push failures do not roll back or disrupt the local note save, logging and presenting a non-blocking failure notice instead
- [x] Skip pushing if the note has no valid Bangumi subject ID or if `pushOnEdit` is disabled
- [x] Include tests verifying persistence safety, dirty check gating, and integration with the edit flow

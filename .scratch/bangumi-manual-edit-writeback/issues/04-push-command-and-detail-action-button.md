# 04: Explicit Push Command and Detail Card Action Button

**What to build:** Direct user controls to push an anime note to Bangumi on demand. Users can trigger a push via the command palette or click a dedicated "Push to Bangumi" button on the anime detail card. This enables users to retry failed pushes or push unedited notes directly without opening the edit dialog.

**Blocked by:** 01: Bangumi Client Upsert and Single Note Push Core, 03: Push On Edit Setting and Multi-language Localization

**Status:** ready-for-agent

- [x] Register command `AnimeList: Push current anime to Bangumi` in the Obsidian command palette
- [x] Add an action button with an upload/push icon and localized tooltip to the anime detail card actions bar
- [x] Read current note frontmatter, extract the Bangumi subject ID, and execute the push routine
- [x] Provide appropriate notices if the command is executed on a non-anime file or a note lacking a Bangumi subject ID
- [x] Include tests or contract checks verifying the command registration and detail card action handling

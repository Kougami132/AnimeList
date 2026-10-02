# Community Release Identity and Legacy Settings Migration

## Context and Decision

The upstream plugin is registered in the Obsidian Community Plugins repository under ID `animelist` by `cwh555`. Because Obsidian Community store guidelines strictly require unique plugin IDs and distinct display names, and to establish clear provenance for features added in this fork (Bangumi two-way sync, manual/edit writeback, Simplified Chinese settings and i18n, broadcast season alignment, and score dashboard filtering), we release the plugin as `animelist-enhanced` with display name `AnimeList Enhanced` by `Kougami132`.

To preserve seamless backward compatibility for existing users migrating from upstream `animelist`, we retain the existing Markdown code block processor `animelist` and introduce automatic configuration fallback: if `.obsidian/plugins/animelist-enhanced/data.json` is absent or empty on startup, the settings store loads and saves configuration from `.obsidian/plugins/animelist/data.json`.

## Status

Accepted

## Considered Options

- **Submit upstream Pull Request or wait for ownership transfer**: The upstream author is inactive or independent; awaiting external review would indefinitely delay Bangumi sync and Chinese localization releases.
- **Change code block identifier to `animelist-enhanced` only**: Rejected because it would break existing Markdown notes across user vaults.
- **Clean slate without migration**: Rejected because requiring users to reconfigure library roots, templates, and provider tokens is a poor upgrade experience.

## Consequences

- The plugin satisfies Obsidian Community submission requirements with a distinct namespace and ID.
- Existing user Markdown notes, code blocks, and templates continue functioning without modification.
- Existing users migrating from the upstream plugin retain all library paths, provider credentials, and preferences automatically.

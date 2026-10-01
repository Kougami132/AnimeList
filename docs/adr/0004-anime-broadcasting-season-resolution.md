# Anime Broadcasting Season Resolution

Anime season and season-year classification follows industry broadcasting seasons (winter/Q1, spring/Q2, summer/Q3, fall/Q4) rather than strict Gregorian calendar quarter calculations.

## Context and Trade-offs

1. Previously, `resolveMediaSeasonMetadata` treated the start date calendar month as canonical and used it to override provider season buckets. This caused edge-case broadcast dates—such as late-night anime airing on June 30 or December 29—to be misclassified into the preceding calendar quarter (e.g., 2026-06-30 Summer anime misclassified as Spring / Q2).
2. We establish a three-tiered resolution precedence:
   - **Provider Explicit Season**: When AniList or another structured provider declares `season` and `seasonYear`, that value is authoritative.
   - **Tag-inferred Season**: When structured season is missing (e.g. pure Bangumi subjects), community tags matching broadcasting season patterns (such as `2026年7月` or `2026夏`) determine the season and season year.
   - **Start Date Calendar Month Fallback**: When no explicit season or tag metadata exists, calendar month fallback (`month <= 3 ? winter : ...`) is used without arbitrary threshold guessing.
3. For cross-year broadcasts (e.g., late December airings belonging to January winter anime), `season_year` follows the broadcast season year (e.g., 2026 Q1) rather than the calendar broadcast date year.
4. Legacy metadata maintenance (`cleanupLegacyMetadataNotes`) verifies and reconciles deviations against this precedence to repair previously misclassified notes in user vaults.

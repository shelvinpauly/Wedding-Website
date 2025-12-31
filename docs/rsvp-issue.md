# RSVP Issue Report

## Summary
RSVP lookups and capacity validation can behave incorrectly in production. The guest list is standardized to columns A–D, but the backend reads columns A–E, which shifts child counts and causes incorrect caps. In addition, name matching is case-insensitive but still punctuation-sensitive, so guests whose names include punctuation (for example, "Bobby?") may fail lookup if they omit the punctuation when typing.

## Impact
- Kids (5-15) and under-5 counts are misread when the active round uses the A–D layout, leading to incorrect dropdown limits and validation failures.
- Guests with punctuation in their listed names can receive “name not found” errors even when the invite is valid.

## Root Cause
`code.gs` assumes a guest list schema with extra columns (A–E) and maps kids 5-15 to column D and under-5 to column E. The production sheets are A–D, so the code reads the wrong columns. The `normalize()` helper lowercases and collapses whitespace but does not strip punctuation.

## Reproduction
1. Set `ACTIVE_INVITE_ROUND = 1`.
2. In the guest list, use a name like “Bobby?” with children counts in columns C and D.
3. Submit the RSVP form with “Bobby” (no punctuation) and choose kids counts.
4. Observe lookup failures or incorrect child caps.

## Fix
- Use fixed column mapping for A–D (Name, Adults, Kids 5-15, Kids <5).
- Strip punctuation in `normalize()` for both input and sheet data to make matching resilient.

## Verification Plan
- Lookup a name with punctuation and confirm it matches without punctuation.
- Confirm adults/kids limits match the A–D columns across all rounds.

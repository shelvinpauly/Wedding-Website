# RSVP Issue Report

## Summary
RSVP lookups and capacity validation can behave incorrectly in production. The guest list is standardized to columns A–D, but the backend reads columns A–E, which shifts child counts and causes incorrect caps. In addition, name matching is case-insensitive but still punctuation-sensitive, so guests whose names include punctuation (for example, "Bobby?") may fail lookup if they omit the punctuation when typing.

## Impact
- Kids (5-15) and under-5 counts are misread when the active round uses the A–D layout, leading to incorrect dropdown limits and validation failures.
- Guests with punctuation in their listed names can receive “name not found” errors even when the invite is valid.

## Root Cause
`code.gs` assumes a guest list schema with extra columns (A–E) and maps kids 5-15 to column D and under-5 to column E. The production sheets are A–D, so the code reads the wrong columns. The `normalize()` helper lowercases and collapses whitespace but does not strip punctuation.

## Reproduction
1. In the guest list (Round 1), use a name like “Bobby?” with children counts in columns C and D.
2. Submit the RSVP form with “Bobby” (no punctuation) and choose kids counts.
3. Observe lookup failures or incorrect child caps.

## Fix
- Use fixed column mapping for A–D (Name, Adults, Kids 5-15, Kids <5).
- Strip punctuation in `normalize()` for both input and sheet data to make matching resilient.

## Verification Plan
- Lookup a name with punctuation and confirm it matches without punctuation.
- Confirm adults/kids limits match the A–D columns across all rounds.

---

## Email Confirmation Formatting

## Summary
RSVP confirmation emails occasionally wrap the RSVP deadline mid-sentence (for example, splitting the year onto a new line).

## Impact
The deadline sentence looks broken or unprofessional in some email clients.

## Root Cause
Plain-text email clients hard-wrap lines (often around 78 characters). The original sentence was long enough to trigger wrapping.

## Fix
Keep the deadline sentence concise enough to avoid hard-wraps, and move the support email to a separate short line. Implemented in `code.gs`.

## Verification Plan
- Send a test RSVP to Gmail and Apple Mail and confirm the deadline sentence stays on one line.
- Confirm the website link appears in the email footer.

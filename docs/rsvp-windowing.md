# RSVP Windowing Notes

## Summary
The RSVP flow now supports different schedules for each side:
- Groom: four rounds (with Round 4 added).
- Bride: one continuous window through February 15, 2026.

Guests are matched to a round by the sheet tab where their name appears, and the RSVP window is enforced per guest.

## Behavior
- Lookup scans Round 1-4 tabs on both sides and returns:
  - guest caps
  - RSVP status: `open`, `not_open`, or `closed`
  - the RSVP window label for messaging
- Name matching prefers exact matches, then falls back to a unique first + last name match.
  If more than one guest shares the same first + last name, the lookup returns an
  "enter your full name" message.
- If the guest's window is not open, the form stays locked and shows the timeline.
- If the guest's window is closed, the form stays locked and shows the timeline.
- Successful submissions include a summary of the RSVP on the page and in the confirmation email.
  The email also includes the exact deadline date for the guest's round.

## Configuration
Update these in `code.gs`:
- `RSVP_TIMEZONE` (should be `America/New_York`)
- `RSVP_WINDOWS` (groom rounds and bride window, using `YYYY-MM-DD` date keys)
- `BRIDE_WINDOW` (single window mapped to rounds 1-4)
- `ROUND_TABS` (Round 1-4 tab names)

Make sure the Apps Script project timezone matches `RSVP_TIMEZONE`.

## Name Matching Rules
1. Normalize input and sheet names: lowercase, strip punctuation, collapse whitespace.
2. Try an exact match on the full normalized name.
3. If no exact match, try a first + last match (first token + last token).
4. If multiple entries share the same first + last, return `AMBIGUOUS_NAME`.

To avoid ambiguity:
- Ensure first + last names are unique across all rounds and both sides, or
- Ask guests to enter their full name as shown on the invitation.

## API Error Codes
- `NOT_FOUND`: No match for the entered name.
- `AMBIGUOUS_NAME`: Multiple guests share the same first + last.
- `RSVP_NOT_OPEN`: Guest round has not opened yet.
- `RSVP_CLOSED`: Guest round is closed.
- Additional POST validation codes: `NAME_REQUIRED`, `ATTENDING_REQUIRED`, `EMAIL_REQUIRED`, `ADULTS_REQUIRED`, `ADULTS_EXCEEDS`, `KIDS_515_EXCEEDS`, `KIDS_U5_EXCEEDS`, `NO_CHANGE`, `MISSING_TAB`, `SERVER_ERROR`.

## Testing Checklist
1. Lookup and submit for a groom guest in Round 1 (open).
2. Lookup a groom guest in Round 2 before Jan 16 (should show not open).
3. Lookup a groom guest in Round 3 after Feb 15 (should show closed).
4. Lookup and submit for a groom guest in Round 4 during Feb 16-Mar 15.
5. Lookup and submit for a bride guest (open through Feb 15).
6. Verify the confirmation email includes the RSVP window and response summary.
7. Test a guest with a middle name/initial using only first + last (should match if unique).
8. Test two guests that share the same first + last (should show ambiguous name).

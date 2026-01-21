# General TODO

## Responsive + Layout
- Test the hero on 320px, 375px, and 414px widths for text overlap or clipping.
- Adjust `--hero-content-offset` per breakpoint to avoid text sitting on busy areas.
- Tune the overlay gradient intensity for legibility across devices.
- Confirm nav wraps cleanly on small screens without pushing content too far down.
- Validate card padding/margins for narrow widths and tablets.
- Check scroll cue alignment on smaller screens.

## RSVP Form UX
- Verify tap target sizes and input spacing on phones.
- Check form messaging and summary blocks for line wrapping on narrow widths.

## Typography
- Confirm headings and buttons retain hierarchy and readability on mobile.
- If keeping Kalnia for body, test weights 400/500 at 16-18px with slight letter-spacing tweaks.

## Content
- Wedding party bios and photos (Bridesmaids and Groomsmen).
- Registry details and links.
- Registry: confirm retailer links and mailing details for gifts/checks (if needed).
- Registry: revisit cash/retail logic and page flow after couple confirms preferences.
- Registry: add Zelle/PayPal/Venmo handles and retail links once confirmed.
- Add a dedicated "Meet the Couple" section after the Welcome paragraph (photos + brief bios).
- Layout ideas to revisit: diptych side-by-side portraits, filmstrip scroll-snap, or hybrid (desktop side-by-side, mobile carousel).

## QA
- Test iPhone-size, iPad-size, and laptop breakpoints.
- Verify FAQ accordion animation and readability on narrow screens.

## Backend / Data
- Add "Unused Invites" column in RSVP response sheets (invited total minus RSVP counts; pending couple approval).
- Enforce unique RSVP emails across both sides and all rounds (pending couple approval).

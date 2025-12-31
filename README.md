# Wedding Website

A responsive wedding website for Shelvin & Nancy's wedding on April 17, 2026.

## Overview
This static website is the central hub for wedding information, including the schedule, RSVP, registry, wedding party, and FAQs. It is built with HTML, CSS, and vanilla JavaScript and is hosted on GitHub Pages.

## Wedding Details
- Date: April 17, 2026
- Ceremony: 10:00 AM - 11:30 AM (please be seated by 9:30 AM)
- Cocktail Hour: 12:00 PM - 1:00 PM
- Reception: 1:00 PM - 5:00 PM (please be seated by 12:45 PM)
- Location: Somerset, NJ
- RSVP Deadline: January 15, 2026

## Architecture
- Frontend: Static HTML pages in the repo root, styled with modular CSS in `css/` and behavior in `js/main.js`.
- RSVP backend: Google Apps Script (`code.gs`) deployed as a web app.
- Data: Guest lists live in two Google Sheets (bride/groom) with round tabs; RSVP responses are stored in the bound spreadsheet tabs.
- Email: Apps Script `MailApp` sends confirmation emails for attending guests.

## RSVP Flow
1. Guest enters their name on `rsvp.html`; the frontend calls the lookup endpoint to fetch guest caps.
2. Form submission posts to Apps Script; the server validates caps, deadline, and invite round.
3. The response is upserted into the appropriate response tab; a confirmation email is sent for "Yes" RSVPs.
4. The frontend applies a cooldown and handles RSVP-closed messaging.

## Project Structure
```
index.html                 # Homepage
schedule.html              # Ceremony and reception details
wedding-party.html         # Wedding party details
registry.html              # Registry links
rsvp.html                  # RSVP form and client-side logic
faqs.html                  # Frequently asked questions
css/
  base.css                 # Root tokens + base element styles
  layout.css               # Nav and layout scaffolding
  components.css           # Buttons, cards, forms, RSVP UI
  pages/
    home.css               # Hero + homepage sections
    schedule.css           # Schedule-specific styles
js/
  main.js                  # Countdown and UI behavior
images/                    # Photos and image assets
assets/
  shelvin-nancy-wedding.ics # Apple/Outlook calendar file
code.gs                    # Apps Script backend (RSVP)
CNAME                      # Custom domain
LICENSE                    # Apache 2.0 license
README.md                  # This file
```

## Configuration Quick Reference
- `rsvp.html`: `RSVP_API_URL`, RSVP deadline text, and client-side copy.
- `code.gs`: `ACTIVE_INVITE_ROUND`, `RSVP_DEADLINE_TEXT`, `RSVP_DEADLINE_DATE`, and guest list spreadsheet IDs.
- `js/main.js`: countdown date/time.
- `schedule.html` and `assets/shelvin-nancy-wedding.ics`: schedule times and calendar details.
- `css/base.css`, `css/layout.css`, `css/components.css`, `css/pages/*.css`: modular styling by layer and page.

## Local Development
1. Open `index.html` directly in a browser, or use a local server for best results:
   ```bash
   python -m http.server 8000
   ```
2. Edit HTML files for content updates.
3. Update the CSS files under `css/` for styling changes.
4. Update `js/main.js` for interactive behavior.

## Deployment
- Static site: push changes to the main branch; GitHub Pages deploys automatically.
- Apps Script:
  1. Open the Apps Script project that contains `code.gs`.
  2. Update code and deploy a new web app version.
  3. If the web app URL changes, update `RSVP_API_URL` in `rsvp.html`.
- Google Sheets: update the guest list spreadsheets for the active invite round.

## Backlog / TODO
- Hero image optimization (resize/compress/WebP).
- Visual styling pass (nav, hover/focus, typography).
- Responsive audit (phone/tablet spacing, accordion touch targets).

## Contributing
This is a personal wedding website, but suggestions are welcome:
1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Submit a pull request.

## License
This project is licensed under the Apache License 2.0 - see `LICENSE` for details.

## Acknowledgments
- Built with love for Shelvin & Nancy
- Inspired by modern wedding website designs

"And now these three remain: faith, hope and love. But the greatest of these is love." - 1 Corinthians 13:13

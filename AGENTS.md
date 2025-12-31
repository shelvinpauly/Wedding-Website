# Repository Guidelines

## Project Structure & Module Organization
This is a static wedding website. Core pages live in the repo root (for example, `index.html`, `schedule.html`, `rsvp.html`, `registry.html`, `wedding-party.html`, `faqs.html`). Styles are split across `css/base.css`, `css/layout.css`, `css/components.css`, and page layers in `css/pages/`. Shared behavior (countdown, small UI logic) is in `js/main.js`. Images belong in `images/`, and downloadable assets (like the calendar `.ics`) live in `assets/`. Keep `CNAME` as-is for the custom domain.

## Build, Test, and Development Commands
There is no build step. For local preview, use a simple server:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` to navigate the pages. Directly opening `index.html` also works, but a server is closer to production behavior.

## Coding Style & Naming Conventions
Match existing formatting: 2-space indentation for HTML/CSS/JS, double quotes for strings and attributes, and kebab-case class names (for example, `hero-top-right`). Keep page content in the HTML files, shared styling in the `css/` layers, and shared behavior in `js/main.js`. If you add new page-specific styles, place them in `css/pages/` with clear section headers.

## Testing Guidelines
No automated test suite is present. Validate changes manually:
- Load each page and confirm layout and navigation.
- Check `rsvp.html` form behavior and messaging (use a real or staging API endpoint).
- Spot-check responsive layouts by resizing the browser.

## Commit & Pull Request Guidelines
Commit history favors short, descriptive summaries (for example, "update schedule and faqs", "add to cal") and includes merge commits from PRs. Keep subjects concise (<= 60 chars) and focused on what changed. Pull requests should include a clear description, link any related issue, and attach screenshots or a short clip for visual changes. Note if content changes affect RSVP timing or schedule details.

## Deployment & Configuration Tips
GitHub Pages deploys from the default branch. Keep `schedule.html` and `assets/shelvin-nancy-wedding.ics` in sync when changing times. If the RSVP backend URL changes, update the `RSVP_API_URL` in `rsvp.html`.

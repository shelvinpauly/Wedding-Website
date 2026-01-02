/**
 * =========================
 * CONFIG (EDIT THESE)
 * =========================
 */

// Use Eastern time for all RSVP windows.
// Make sure the Apps Script timezone is set to America/New_York.
const RSVP_TIMEZONE = "America/New_York";

// RSVP windows by side + round. Month is 0-based (Jan = 0).
const BRIDE_WINDOW = {
  startDate: "2020-01-01", // open now
  endDate: "2026-02-15",
  label: "Now - February 15, 2026"
};

const RSVP_WINDOWS = {
  BRIDE: {
    1: BRIDE_WINDOW,
    2: BRIDE_WINDOW,
    3: BRIDE_WINDOW
  },
  GROOM: {
    1: {
      startDate: "2020-01-01", // open now
      endDate: "2026-01-15",
      label: "Now - January 15, 2026"
    },
    2: {
      startDate: "2026-01-16",
      endDate: "2026-01-31",
      label: "January 16 - January 31, 2026"
    },
    3: {
      startDate: "2026-02-01",
      endDate: "2026-02-15",
      label: "February 1 - February 15, 2026"
    }
  }
};

const ROUND_TABS = ["Round 1", "Round 2", "Round 3"];

const NOT_FOUND_MESSAGE = "We couldn't find that name on the guest list. Please enter the name exactly as shown on your invitation.";
const AMBIGUOUS_MESSAGE = "We found multiple guests with that first and last name. Please enter your full name as shown on your invitation.";

// Guest list spreadsheets (one for bride, one for groom)
const BRIDE_GUEST_LIST_SPREADSHEET_ID = "11S6ZFxRYyPkHa_YEucNhNPPABRM0ygHvZWHkRcYGsrE";
const GROOM_GUEST_LIST_SPREADSHEET_ID = "1hu42DFI2OazS5kGVJ86_HBwtBRCuaQvPDvXKV2B5M6Q";

// RSVP response tabs in *this* (bound) spreadsheet
const BRIDE_RSVP_TAB = "Bride Responses";
const GROOM_RSVP_TAB = "Groom Responses";

/**
 * Column mapping in guest list tab (standardized):
 * A: Name (responsible person)
 * B: Adults (15+)
 * C: Children (5-15)
 * D: Children (under 5)
 */
const COL_NAME = 1;
const COL_ADULTS = 2;
const COL_KIDS_515 = 3;
const COL_KIDS_U5 = 4;

/**
 * =========================
 * LOOKUP ENDPOINT (GET)
 * =========================
 * Called by the website after user types name.
 * Example:
 *   /exec?action=lookup&name=John%20Doe
 */
function doGet(e) {
  try {
    const action = (e.parameter.action || "").trim();

    if (action !== "lookup") {
      return json({ ok: false, error: "Unsupported action." }, 400);
    }

    const nameRaw = (e.parameter.name || "").trim();
    if (!nameRaw) return json({ ok: false, error: "Name is required." }, 400);

    const lookup = lookupGuestAcrossRounds_(normalize(nameRaw));

    if (!lookup) {
      return json({
        ok: false,
        code: "NOT_FOUND",
        error: NOT_FOUND_MESSAGE
      }, 404);
    }

    if (lookup.error) {
      return json({
        ok: false,
        code: lookup.error,
        error: AMBIGUOUS_MESSAGE
      }, 409);
    }

    const windowStatus = getRsvpWindowStatus_(lookup.side, lookup.round);

    return json({
      ok: true,
      ...lookup,
      status: windowStatus.status,
      windowText: windowStatus.windowText
    }, 200);

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
}

/**
 * =========================
 * SUBMISSION ENDPOINT (POST)
 * =========================
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    const nameRaw = (payload.name || "").trim();
    const email = (payload.email || "").trim();
    const attending = String(payload.attending || "").trim().toLowerCase(); // "yes" or "no"

    const adults = toInt(payload.adults);
    const kids515 = toInt(payload.kids515);
    const kidsUnder5 = toInt(payload.kidsUnder5);
    const message = (payload.message || "").trim();

    if (!nameRaw) return json({ ok: false, error: "Name is required." }, 400);
    if (!attending || (attending !== "yes" && attending !== "no")) {
      return json({ ok: false, error: "Please choose whether you will be attending." }, 400);
    }

    // If attending = yes, require email
    if (attending === "yes" && !email) {
      return json({ ok: false, error: "Email is required if you are attending." }, 400);
    }

    // Determine side + allowed caps from guest list (any round)
    const nameKey = normalize(nameRaw);
    const lookup = lookupGuestAcrossRounds_(nameKey);

    if (!lookup) {
      return json({
        ok: false,
        code: "NOT_FOUND",
        error: NOT_FOUND_MESSAGE
      }, 404);
    }

    if (lookup.error) {
      return json({
        ok: false,
        code: lookup.error,
        error: AMBIGUOUS_MESSAGE
      }, 409);
    }

    const name = lookup.name || nameRaw;
    const windowStatus = getRsvpWindowStatus_(lookup.side, lookup.round);
    if (windowStatus.status === "not_open") {
      return json({
        ok: false,
        code: "RSVP_NOT_OPEN",
        error: `RSVP is not open yet for your invitation. Your RSVP window is ${windowStatus.windowText}.`,
        windowText: windowStatus.windowText
      }, 403);
    }

    if (windowStatus.status === "closed") {
      return json({
        ok: false,
        code: "RSVP_CLOSED",
        error: `RSVP is closed for your invitation. Your RSVP window was ${windowStatus.windowText}.`,
        windowText: windowStatus.windowText
      }, 403);
    }

    // If attending = no, force counts to 0 (simple)
    const finalAdults = attending === "no" ? 0 : adults;
    const finalKids515 = attending === "no" ? 0 : kids515;
    const finalKidsUnder5 = attending === "no" ? 0 : kidsUnder5;

    // If attending is YES, at least 1 adult must attend
    if (attending === "yes" && finalAdults < 1) {
      return json({ ok: false, error: "If you are attending, please select at least 1 adult." }, 400);
    }


    // Validate caps (prevents manual HTML tampering)
    if (finalAdults > lookup.maxAdults) {
      return json({ ok: false, error: `Adults cannot exceed ${lookup.maxAdults}.` }, 400);
    }
    if (finalKids515 > lookup.maxKids515) {
      return json({ ok: false, error: `Children (5–15) cannot exceed ${lookup.maxKids515}.` }, 400);
    }
    if (finalKidsUnder5 > lookup.maxKidsUnder5) {
      return json({ ok: false, error: `Children (under 5) cannot exceed ${lookup.maxKidsUnder5}.` }, 400);
    }

    // Write RSVP into correct tab in bound spreadsheet
    const rsvpSs = SpreadsheetApp.getActiveSpreadsheet();
    const targetTab = lookup.side === "BRIDE" ? BRIDE_RSVP_TAB : GROOM_RSVP_TAB;
    const sheet = rsvpSs.getSheetByName(targetTab);
    if (!sheet) return json({ ok: false, error: `Missing tab: ${targetTab}` }, 500);

    const result = upsertRsvpRow_(sheet, {
      timestamp: new Date(),
      name: name,
      attending: attending.toUpperCase(),
      adults: finalAdults,
      kids515: finalKids515,
      kidsUnder5: finalKidsUnder5,
      email: email || "",
      message: message,
      round: lookup.round
    });

    if (result.action === "no_change") {
      return json({
        ok: false,
        error: "We already have this exact RSVP on file. If you want to update it, please change your response and submit again."
      }, 409);
    }


    // Email behavior
    const windowText = windowStatus.windowText;
    const summaryLines = buildRsvpSummaryLines_({
      attending,
      adults: finalAdults,
      kids515: finalKids515,
      kidsUnder5: finalKidsUnder5,
      email,
      message
    }, windowText);

    if (attending === "yes") {
      const window = getRsvpWindow_(lookup.side, lookup.round);
      const deadlineText = getWindowEndDateText_(window);
      const responseLines = buildRsvpResponseLines_({
        attending,
        adults: finalAdults,
        kids515: finalKids515,
        kidsUnder5: finalKidsUnder5,
        email,
        message
      });
      sendConfirmationEmail_(email, name, responseLines, deadlineText);
    }

    return json({
      ok: true,
      side: lookup.side,
      round: lookup.round,
      windowText,
      summary: summaryLines
    }, 200);


  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
}

/**
 * =========================
 * LOOKUP HELPERS
 * =========================
 */
function lookupGuestAcrossRounds_(nameKey) {
  if (!nameKey) return null;

  const shortKey = buildShortKey_(nameKey);
  const exactMatches = [];
  const partialMatches = [];

  const brideSs = SpreadsheetApp.openById(BRIDE_GUEST_LIST_SPREADSHEET_ID);
  const groomSs = SpreadsheetApp.openById(GROOM_GUEST_LIST_SPREADSHEET_ID);

  for (let i = 0; i < ROUND_TABS.length; i++) {
    const round = i + 1;
    const tabName = ROUND_TABS[i];

    collectMatches_(brideSs, tabName, nameKey, shortKey, "BRIDE", round, exactMatches, partialMatches);
    collectMatches_(groomSs, tabName, nameKey, shortKey, "GROOM", round, exactMatches, partialMatches);
  }

  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return { error: "AMBIGUOUS_NAME" };

  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length > 1) return { error: "AMBIGUOUS_NAME" };

  return null;
}

function collectMatches_(ss, tabName, nameKey, shortKey, side, round, exactMatches, partialMatches) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Read columns A-D for all guests (Row 2 onward)
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  for (const row of data) {
    const rawName = String(row[COL_NAME - 1] || "").trim();
    const normalized = normalize(rawName);
    if (!normalized) continue;

    const maxAdults = toInt(row[COL_ADULTS - 1]);
    const maxKids515 = toInt(row[COL_KIDS_515 - 1]);
    const maxKidsUnder5 = toInt(row[COL_KIDS_U5 - 1]);

    if (normalized === nameKey) {
      exactMatches.push({ side, round, maxAdults, maxKids515, maxKidsUnder5, name: rawName });
      continue;
    }

    if (shortKey && buildShortKey_(normalized) === shortKey) {
      partialMatches.push({ side, round, maxAdults, maxKids515, maxKidsUnder5, name: rawName });
    }
  }
}

/**
 * Upsert RSVP row by (Name + Invite Round).
 * If found, overwrite that row. Otherwise append a new row.
 *
 * Assumes RSVP sheet columns:
 * A Timestamp
 * B Name
 * C Attending
 * D Adults
 * E Kids (5-15)
 * F Kids (<5)
 * G Email
 * H Message
 * I Invite Round
 */
function upsertRsvpRow_(sheet, rsvp) {
  const lastRow = sheet.getLastRow();

  // Insert if empty (or only headers)
  if (lastRow < 2) {
    sheet.appendRow([
      rsvp.timestamp,
      rsvp.name,
      rsvp.attending,
      rsvp.adults,
      rsvp.kids515,
      rsvp.kidsUnder5,
      rsvp.email,
      rsvp.message,
      rsvp.round
    ]);
    return { action: "inserted" };
  }

  const numRows = lastRow - 1;

  // Read existing Name (B) + Round (I)
  const names = sheet.getRange(2, 2, numRows, 1).getValues().flat();   // col B
  const rounds = sheet.getRange(2, 9, numRows, 1).getValues().flat();  // col I

  const targetNameKey = normalize(rsvp.name);
  const targetRound = Number(rsvp.round);

  for (let i = 0; i < numRows; i++) {
    if (normalize(String(names[i] || "")) === targetNameKey && Number(rounds[i]) === targetRound) {
      const rowIndex = i + 2;

      // Read existing full row A..I
      const existing = sheet.getRange(rowIndex, 1, 1, 9).getValues()[0];

      const proposed = [
        rsvp.timestamp, // timestamp always changes, so compare without it
        rsvp.name,
        rsvp.attending,
        rsvp.adults,
        rsvp.kids515,
        rsvp.kidsUnder5,
        rsvp.email,
        rsvp.message,
        rsvp.round
      ];

      // Compare everything except timestamp (index 0)
      const existingComparable = [
        existing[0], // ignored
        String(existing[1] || ""),
        String(existing[2] || ""),
        Number(existing[3] || 0),
        Number(existing[4] || 0),
        Number(existing[5] || 0),
        String(existing[6] || ""),
        String(existing[7] || ""),
        Number(existing[8] || 0),
      ];

      const proposedComparable = [
        proposed[0], // ignored
        String(proposed[1] || ""),
        String(proposed[2] || ""),
        Number(proposed[3] || 0),
        Number(proposed[4] || 0),
        Number(proposed[5] || 0),
        String(proposed[6] || ""),
        String(proposed[7] || ""),
        Number(proposed[8] || 0),
      ];

      let changed = false;
      for (let j = 1; j < proposedComparable.length; j++) {
        if (proposedComparable[j] !== existingComparable[j]) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        return { action: "no_change", row: rowIndex };
      }

      // Overwrite A..I (new timestamp + new values)
      sheet.getRange(rowIndex, 1, 1, 9).setValues([[
        rsvp.timestamp,
        rsvp.name,
        rsvp.attending,
        rsvp.adults,
        rsvp.kids515,
        rsvp.kidsUnder5,
        rsvp.email,
        rsvp.message,
        rsvp.round
      ]]);

      return { action: "updated", row: rowIndex };
    }
  }

  // Not found → append
  sheet.appendRow([
    rsvp.timestamp,
    rsvp.name,
    rsvp.attending,
    rsvp.adults,
    rsvp.kids515,
    rsvp.kidsUnder5,
    rsvp.email,
    rsvp.message,
    rsvp.round
  ]);

  return { action: "inserted" };
}


/**
 * =========================
 * EMAIL + HELPERS
 * =========================
 */
function sendConfirmationEmail_(email, name, responseLines, deadlineText) {
  const subject = "RSVP Confirmation - Shelvin & Nancy";
  const summary = responseLines.map((line) => `- ${line}`).join("\n");
  const body =
`Hi ${name},

Thank you for your RSVP!
We are so happy you can join us.
Your presence means a lot to us.

Here is what we have down for your party:
${summary}

If you need to make changes, please resubmit by ${deadlineText}.
Questions? Email us at shelvinancy@gmail.com.

We can't wait to celebrate with you.

With love,
Shelvin & Nancy
Website: https://shelvinandnancy.com
`;
  MailApp.sendEmail(email, subject, body);
}

function getRsvpWindow_(side, round) {
  const windows = RSVP_WINDOWS[side] || {};
  const window = windows[round];
  if (!window) {
    throw new Error(`Missing RSVP window for ${side} round ${round}`);
  }
  return window;
}

function getRsvpWindowStatus_(side, round) {
  const window = getRsvpWindow_(side, round);
  const today = getTodayDateKey_();
  const windowText = getWindowLabel_(window);

  if (today < window.startDate) {
    return { status: "not_open", windowText };
  }
  if (today > window.endDate) {
    return { status: "closed", windowText };
  }
  return { status: "open", windowText };
}

function buildRsvpSummaryLines_(rsvp, windowText) {
  const lines = [`RSVP window: ${windowText}`];
  lines.push(`Attending: ${rsvp.attending === "yes" ? "Yes" : "No"}`);

  if (rsvp.attending === "yes") {
    lines.push(`Adults: ${rsvp.adults}`);
    lines.push(`Children (5-15): ${rsvp.kids515}`);
    lines.push(`Children (under 5): ${rsvp.kidsUnder5}`);
  }

  if (rsvp.email) lines.push(`Email: ${rsvp.email}`);
  if (rsvp.message) lines.push(`Message: ${rsvp.message}`);
  return lines;
}

function buildRsvpResponseLines_(rsvp) {
  const lines = [];
  lines.push(`Adults: ${rsvp.adults}`);
  lines.push(`Children (5-15): ${rsvp.kids515}`);
  lines.push(`Children (under 5): ${rsvp.kidsUnder5}`);
  return lines;
}

function getWindowLabel_(window) {
  if (window.label) return window.label;
  const start = formatDateKey_(window.startDate);
  const end = formatDateKey_(window.endDate);
  return `${start} - ${end}`;
}

function getWindowEndDateText_(window) {
  return formatDateKey_(window.endDate);
}

function getTodayDateKey_() {
  return Utilities.formatDate(new Date(), RSVP_TIMEZONE, "yyyy-MM-dd");
}

function formatDateKey_(dateKey) {
  if (!dateKey) return "";
  const safeDate = new Date(`${dateKey}T12:00:00Z`);
  return Utilities.formatDate(safeDate, RSVP_TIMEZONE, "MMMM d, yyyy");
}

function normalize(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function buildShortKey_(nameKey) {
  const parts = (nameKey || "").split(" ").filter(Boolean);
  if (parts.length < 2) return "";
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


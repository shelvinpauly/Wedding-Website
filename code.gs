/**
 * =========================
 * CONFIG (EDIT THESE)
 * =========================
 */

// Change this when you move to the next invite round.
const ACTIVE_INVITE_ROUND = 1; // 1, 2, or 3

// RSVP deadline shown to guests (no mention of "round" in the UI).
// EDIT THIS whenever you change invite rounds.
const RSVP_DEADLINE_TEXT = "RSVP by January 15, 2026"; // <-- EDIT PER ROUND
// Keep RSVP_DEADLINE_TEXT and RSVP_DEADLINE_DATE in sync.
// Use script timezone. January is month 0.
const RSVP_DEADLINE_DATE = new Date(2026, 0, 15, 23, 59, 59);

// Guest list spreadsheets (one for bride, one for groom)
const BRIDE_GUEST_LIST_SPREADSHEET_ID = "11S6ZFxRYyPkHa_YEucNhNPPABRM0ygHvZWHkRcYGsrE";
const GROOM_GUEST_LIST_SPREADSHEET_ID = "1hu42DFI2OazS5kGVJ86_HBwtBRCuaQvPDvXKV2B5M6Q";

// RSVP response tabs in *this* (bound) spreadsheet
const BRIDE_RSVP_TAB = "Bride Responses";
const GROOM_RSVP_TAB = "Groom Responses";

/**
 * Your guest list tabs are named:
 * Round 1, Round 2, Round 3
 */
function getRoundTabName_() {
  if (ACTIVE_INVITE_ROUND === 1) return "Round 1";
  if (ACTIVE_INVITE_ROUND === 2) return "Round 2";
  if (ACTIVE_INVITE_ROUND === 3) return "Round 3";
  throw new Error("ACTIVE_INVITE_ROUND must be 1, 2, or 3");
}

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

    if (action === "status") {
      return json({
        ok: true,
        closed: isRsvpClosed_(),
        deadlineText: RSVP_DEADLINE_TEXT
      }, 200);
    }

    if (action !== "lookup") {
      return json({ ok: false, error: "Unsupported action." }, 400);
    }

    const nameRaw = (e.parameter.name || "").trim();
    if (!nameRaw) return json({ ok: false, error: "Name is required." }, 400);

    const lookup = lookupGuest_(normalize(nameRaw));

    if (!lookup) {
      return json({
        ok: false,
        error: "We couldn’t find that name on the guest list. Please enter the name exactly as shown on your invitation."
      }, 404);
    }

    return json({ ok: true, ...lookup }, 200);

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

    if (isRsvpClosed_()) {
      return json({
        ok: false,
        code: "RSVP_CLOSED",
        error: "RSVPs are now closed. If you need to make a change, please email us at shelvinancy@gmail.com.",
        deadlineText: RSVP_DEADLINE_TEXT
      }, 403);
    }

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

    // Determine side + allowed caps from guest list (active round only)
    const nameKey = normalize(nameRaw);
    const lookup = lookupGuest_(nameKey);

    if (!lookup) {
      return json({
        ok: false,
        error: "We couldn’t find that name on the guest list. Please enter the name exactly as shown on your invitation."
      }, 404);
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
      name: nameRaw,
      attending: attending.toUpperCase(),
      adults: finalAdults,
      kids515: finalKids515,
      kidsUnder5: finalKidsUnder5,
      email: email || "",
      message: message,
      round: ACTIVE_INVITE_ROUND
    });

    if (result.action === "no_change") {
      return json({
        ok: false,
        error: "We already have this exact RSVP on file. If you want to update it, please change your response and submit again."
      }, 409);
    }


    // Email behavior
    if (attending === "yes") {
      sendConfirmationEmail_(email, nameRaw);
    }

    return json({
      ok: true,
      side: lookup.side,
      deadlineText: RSVP_DEADLINE_TEXT
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
function lookupGuest_(nameKey) {
  const roundTab = getRoundTabName_();

  // Try Bride list
  const bride = findGuestRow_(BRIDE_GUEST_LIST_SPREADSHEET_ID, roundTab, nameKey);
  if (bride) return { side: "BRIDE", ...bride };

  // Try Groom list
  const groom = findGuestRow_(GROOM_GUEST_LIST_SPREADSHEET_ID, roundTab, nameKey);
  if (groom) return { side: "GROOM", ...groom };

  return null;
}

function findGuestRow_(spreadsheetId, tabName, nameKey) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(`Guest list tab "${tabName}" not found in spreadsheet ${spreadsheetId}`);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Read columns A-D for all guests (Row 2 onward)
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  for (const row of data) {
    const rawName = String(row[COL_NAME - 1] || "");
    if (normalize(rawName) === nameKey) {
      const maxAdults = toInt(row[COL_ADULTS - 1]);
      const maxKids515 = toInt(row[COL_KIDS_515 - 1]);
      const maxKidsUnder5 = toInt(row[COL_KIDS_U5 - 1]);

      return { maxAdults, maxKids515, maxKidsUnder5 };
    }
  }

  return null;
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
function sendConfirmationEmail_(email, name) {
  const subject = "RSVP Confirmation - Shelvin & Nancy";
  const body =
`Hi ${name},

Thank you for your RSVP! We have your response on file.

${RSVP_DEADLINE_TEXT}

If you need to make changes, please submit the RSVP form again before the deadline or email us at shelvinancy@gmail.com.

We will share additional instructions as the date gets closer.

With love,
Shelvin & Nancy
`;
  MailApp.sendEmail(email, subject, body);
}

function isRsvpClosed_() {
  return new Date() > RSVP_DEADLINE_DATE;
}

function normalize(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
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


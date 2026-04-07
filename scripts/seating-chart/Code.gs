/**
 * Seating Chart Lookup (Google Apps Script) - Simple + Fast
 *
 * Deploy as a Web App and call with:
 *   /exec?action=seating&name=First%20Last&team=BRIDE
 *
 * Reads from two tabs:
 * - Bride Response
 * - Groom Responses
 *
 * Required headers (row 1):
 * - Name
 * - Seats
 * - Table Number
 */

const SEATING_CONFIG = {
  // If this script is bound to the seating spreadsheet, leave blank.
  // Otherwise set the spreadsheet ID (the long string in the Sheet URL).
  spreadsheetId: "",

  // Tab name candidates (keeps it resilient to small naming differences).
  brideTabs: ["Bride Response", "Bride Responses", "Bride's Response", "Bride's Responses"],
  groomTabs: ["Groom Responses", "Groom Response", "Groom's Responses", "Groom's Response"],

  // Column header candidates (row 1).
  nameHeaders: ["Name"],
  seatsHeaders: ["Seats"],
  tableHeaders: ["Table Number", "Table", "Table #", "Seat", "Seat Number"],

  // Optional: set a code to prevent random lookups.
  // If set, requests must include &code=YOUR_CODE
  accessCode: "",

  // Optional: log which team guests picked (this is a sheet write, so keep off for max speed).
  teamLogEnabled: false,
  teamLogSheet: "Seating Team Picks",
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).trim() : "";
    if (action !== "seating") return json_({ ok: false, code: "UNSUPPORTED_ACTION", error: "Unsupported action." }, 400);

    if (SEATING_CONFIG.accessCode) {
      const supplied = (e.parameter.code || "").trim();
      if (supplied !== SEATING_CONFIG.accessCode) {
        return json_({ ok: false, code: "UNAUTHORIZED", error: "This seating link is not authorized." }, 401);
      }
    }

    const nameRaw = (e.parameter.name || "").trim();
    if (!nameRaw) return json_({ ok: false, code: "NAME_REQUIRED", error: "Name is required." }, 400);

    const teamParam = (e.parameter.team || e.parameter.side || "").trim();
    const team = normalizeTeam_(teamParam);

    const ss = getSpreadsheet_();
    if (!ss) {
      return json_({
        ok: false,
        code: "SPREADSHEET_NOT_SET",
        error: "Seating backend is not connected to a spreadsheet. Bind this script to your RSVP response Google Sheet, or set SEATING_CONFIG.spreadsheetId."
      }, 500);
    }

    const brideSheet = resolveSheet_(ss, SEATING_CONFIG.brideTabs);
    const groomSheet = resolveSheet_(ss, SEATING_CONFIG.groomTabs);
    if (!brideSheet || !groomSheet) {
      return json_({
        ok: false,
        code: "SHEETS_MISSING",
        error: `Missing response tab(s). Found: ${ss.getSheets().map((s) => `"${s.getName()}"`).join(", ")}`
      }, 500);
    }

    const order = team === "GROOM"
      ? [{ side: "GROOM", sheet: groomSheet }, { side: "BRIDE", sheet: brideSheet }]
      : [{ side: "BRIDE", sheet: brideSheet }, { side: "GROOM", sheet: groomSheet }];

    let found = null;
    let foundSide = "";
    for (const entry of order) {
      const result = lookupInSheet_(entry.sheet, nameRaw);
      if (result && result.error) return json_({ ok: false, code: result.code, error: result.error }, result.status || 500);
      if (result && result.ok) {
        found = result.data;
        foundSide = entry.side;
        break;
      }
    }

    if (!found) {
      return json_({
        ok: false,
        code: "NOT_FOUND",
        error: "We couldn't find that name. Please enter it exactly as on the invitation."
      }, 404);
    }

    if (SEATING_CONFIG.teamLogEnabled && team) {
      logTeamPick_(ss, {
        timestamp: new Date(),
        inputName: nameRaw,
        matchedName: found.name,
        team,
        sideFound: foundSide,
        table: found.table || "",
      });
    }

    return json_({ ok: true, ...found, side: foundSide }, 200);
  } catch (err) {
    return json_({ ok: false, code: "SERVER_ERROR", error: String(err) }, 500);
  }
}

function lookupInSheet_(sheet, nameRaw) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return null;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h || "").trim());
  const nameCol = findHeaderIndex_(headers, SEATING_CONFIG.nameHeaders);
  const seatsCol = findHeaderIndex_(headers, SEATING_CONFIG.seatsHeaders);
  const tableCol = findHeaderIndex_(headers, SEATING_CONFIG.tableHeaders);

  if (!nameCol || !seatsCol || !tableCol) {
    const missing = [
      !nameCol ? "Name" : null,
      !seatsCol ? "Seats" : null,
      !tableCol ? "Table Number" : null,
    ].filter(Boolean);

    return {
      ok: false,
      code: "MISSING_COLUMNS",
      status: 500,
      error: `Missing required column(s): ${missing.join(", ")} in "${sheet.getName()}".`
    };
  }

  const numRows = lastRow - 1;
  const nameRange = sheet.getRange(2, nameCol, numRows, 1);
  const matches = nameRange
    .createTextFinder(nameRaw)
    .matchCase(false)
    .matchEntireCell(true)
    .findAll();

  if (!matches || matches.length === 0) return null;
  if (matches.length > 1) {
    return {
      ok: false,
      code: "AMBIGUOUS_NAME",
      status: 409,
      error: "Multiple matches found. Please enter the full name exactly as on the invitation."
    };
  }

  const rowIndex = matches[0].getRow();
  const seats = toInt_(sheet.getRange(rowIndex, seatsCol, 1, 1).getValue());
  const table = String(sheet.getRange(rowIndex, tableCol, 1, 1).getValue() || "").trim();

  return {
    ok: true,
    data: {
      name: String(sheet.getRange(rowIndex, nameCol, 1, 1).getValue() || "").trim() || nameRaw,
      seats,
      table,
    }
  };
}

function resolveSheet_(ss, candidates) {
  for (const name of candidates || []) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return null;
}

function findHeaderIndex_(headers, candidates) {
  const normalized = headers.map((h) => normalize_(h));
  for (const cand of candidates || []) {
    const idx = normalized.indexOf(normalize_(cand));
    if (idx >= 0) return idx + 1;
  }
  return 0;
}

function getSpreadsheet_() {
  if (SEATING_CONFIG.spreadsheetId) return SpreadsheetApp.openById(SEATING_CONFIG.spreadsheetId);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function normalizeTeam_(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (s === "BRIDE" || s === "TEAM_BRIDE") return "BRIDE";
  if (s === "GROOM" || s === "TEAM_GROOM") return "GROOM";
  return "";
}

function normalize_(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function toInt_(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function json_(obj, status) {
  const out = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  if (status && !obj.status) obj.status = status;
  return out;
}

function logTeamPick_(ss, entry) {
  let sheet = ss.getSheetByName(SEATING_CONFIG.teamLogSheet);
  if (!sheet) {
    sheet = ss.insertSheet(SEATING_CONFIG.teamLogSheet);
    sheet.appendRow(["Timestamp", "Input Name", "Matched Name", "Team Picked", "Side Found", "Table"]);
  }
  sheet.appendRow([entry.timestamp, entry.inputName, entry.matchedName, entry.team, entry.sideFound, entry.table]);
}

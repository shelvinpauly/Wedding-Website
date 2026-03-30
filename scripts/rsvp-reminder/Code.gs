/**
 * RSVP Reminder Email Script (Google Apps Script)
 *
 * Purpose:
 * - Read RSVP responses from the response spreadsheet tabs
 * - Email a reminder with schedule + directions + RSVP counts
 * - Mark rows as "sent" to avoid double-sending
 *
 * How to use (high level):
 * - Bind this script to the RSVP response spreadsheet (or set CONFIG.spreadsheetId)
 * - Update CONFIG, start with dryRun=true, then set dryRun=false to send
 */

const CONFIG = {
  // If this script is bound to the RSVP response spreadsheet, leave blank.
  // Otherwise set the spreadsheet ID (the long string in the Sheet URL).
  spreadsheetId: "",

  // RSVP response tabs (default names used by the RSVP backend).
  responseTabs: ["Bride Responses", "Groom Responses"],

  // Column header used to mark that a reminder was sent.
  sentAtHeader: "Reminder Sent At",

  // Safety switches.
  dryRun: true,
  forceResend: false,

  // If set, only send to this one address (useful for testing).
  onlySendToEmail: "",

  // If set, send all reminders to this address instead of the guests' emails.
  // (The original recipient email will still be logged.)
  overrideRecipientEmail: "",

  // Email settings.
  replyTo: "shelvinancy@gmail.com",
  subject: "Wedding Reminder - Shelvin & Nancy (April 17, 2026)",

  websiteUrl: "https://shelvinandnancy.com",
  scheduleUrl: "https://shelvinandnancy.com/schedule.html",
  faqsUrl: "https://shelvinandnancy.com/faqs.html",

  // Wedding day details (keep in sync with schedule.html).
  ceremony: {
    date: "April 17, 2026",
    time: "10:00 AM - 11:30 AM",
    beSeatedBy: "9:30 AM",
    venue: "First Baptist Church of Lincoln Gardens",
    address: "771 Somerset Street, Franklin Township, NJ 08873",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=First%20Baptist%20Church%20of%20Lincoln%20Gardens%2C%20771%20Somerset%20Street%2C%20Franklin%20Township%2C%20NJ%2008873",
  },
  reception: {
    date: "April 17, 2026",
    time: "12:00 PM - 5:00 PM",
    cocktailHour: "12:00 PM - 1:00 PM",
    programStarts: "1:00 PM",
    beSeatedBy: "12:45 PM",
    venue: "The Marigold",
    address: "315 Churchill Ave, Somerset, NJ 08873",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=The%20Marigold%2C%20315%20Churchill%20Ave%2C%20Somerset%2C%20NJ%2008873",
  },

  // Add/remove reminder bullets anytime before sending.
  extraBullets: [
    "Dress code: semi-formal (traditional ethnic attire is welcome).",
    "Parking is available on-site at both venues.",
    "Seating details for the reception will be provided at the venue on the day of.",
  ],
};

/**
 * Main entrypoint.
 * Run this from Apps Script.
 */
function sendWeddingReminderEmails() {
  const ss = getSpreadsheet_();
  const sheets = CONFIG.responseTabs.map((name) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(`Missing RSVP response tab: "${name}"`);
    return sheet;
  });

  const logSheet = ensureLogSheet_(ss);

  const rowsBySheet = sheets.map((sheet) => {
    const sentCol = ensureSentAtColumn_(sheet, CONFIG.sentAtHeader);
    const parsed = readRsvpRows_(sheet, sentCol, CONFIG.sentAtHeader);
    return { sheet, sentCol, parsed };
  });

  const allRows = rowsBySheet.flatMap((entry) => entry.parsed);
  const eligible = allRows.filter((row) => row.attending === "yes" && row.email);

  const groups = groupByEmail_(eligible);
  Logger.log(`Eligible emails: ${groups.length}`);

  for (const group of groups) {
    if (CONFIG.onlySendToEmail && group.email.toLowerCase() !== CONFIG.onlySendToEmail.toLowerCase()) {
      continue;
    }

    const alreadySent = !CONFIG.forceResend && group.rows.some((r) => Boolean(r.sentAt));
    if (alreadySent) {
      Logger.log(`SKIP (already sent): ${group.email}`);
      continue;
    }

    const recipient = CONFIG.overrideRecipientEmail || group.email;
    const subject = CONFIG.subject;
    const body = buildReminderEmailBody_(group);

    if (CONFIG.dryRun) {
      Logger.log(`DRY RUN -> Would send to: ${recipient} (original: ${group.email}) names=${group.rows.map((r) => r.name).join(" / ")}`);
      Logger.log(body);
      continue;
    }

    try {
      MailApp.sendEmail({
        to: recipient,
        subject,
        body,
        replyTo: CONFIG.replyTo,
      });

      const sentAt = new Date();
      markGroupSent_(group, sentAt, CONFIG.sentAtHeader);
      appendLog_(logSheet, {
        sentAt,
        email: group.email,
        names: group.rows.map((r) => r.name).join(" / "),
        totalGuests: group.totalGuests,
        recipient,
        status: "SENT",
        error: "",
      });

      Logger.log(`SENT -> ${recipient} (original: ${group.email})`);
    } catch (err) {
      appendLog_(logSheet, {
        sentAt: new Date(),
        email: group.email,
        names: group.rows.map((r) => r.name).join(" / "),
        totalGuests: group.totalGuests,
        recipient,
        status: "ERROR",
        error: String(err && err.message ? err.message : err),
      });
      Logger.log(`ERROR -> ${group.email}: ${err}`);
    }
  }
}

function buildReminderEmailBody_(group) {
  const greetingName = group.rows[0] && group.rows[0].name ? group.rows[0].name : "there";
  const lines = [];

  lines.push(`Hi ${greetingName},`);
  lines.push("");
  lines.push("Just a quick reminder as we get closer to the wedding. Here are the key details:");
  lines.push("");

  lines.push("CEREMONY");
  lines.push(`- Date: ${CONFIG.ceremony.date}`);
  lines.push(`- Time: ${CONFIG.ceremony.time} (please be seated by ${CONFIG.ceremony.beSeatedBy})`);
  lines.push(`- Venue: ${CONFIG.ceremony.venue}`);
  lines.push(`- Address: ${CONFIG.ceremony.address}`);
  lines.push(`- Directions: ${CONFIG.ceremony.mapsUrl}`);
  lines.push("");

  lines.push("RECEPTION");
  lines.push(`- Date: ${CONFIG.reception.date}`);
  lines.push(`- Time: ${CONFIG.reception.time} (please be seated by ${CONFIG.reception.beSeatedBy})`);
  lines.push(`- Cocktail hour: ${CONFIG.reception.cocktailHour}`);
  lines.push(`- Program starts: ${CONFIG.reception.programStarts}`);
  lines.push(`- Venue: ${CONFIG.reception.venue}`);
  lines.push(`- Address: ${CONFIG.reception.address}`);
  lines.push(`- Directions: ${CONFIG.reception.mapsUrl}`);
  lines.push("");

  lines.push("YOUR RSVP ON FILE");
  for (const row of group.rows) {
    const total = (row.adults || 0) + (row.kids515 || 0) + (row.kidsUnder5 || 0);
    const breakdown = [
      `Adults: ${row.adults || 0}`,
      `Children (5-15): ${row.kids515 || 0}`,
      `Children (under 5): ${row.kidsUnder5 || 0}`,
      `Total: ${total}`,
    ].join(", ");
    lines.push(`- ${row.name}: ${breakdown}`);
  }
  lines.push("");

  if (Array.isArray(CONFIG.extraBullets) && CONFIG.extraBullets.length) {
    lines.push("NOTES");
    for (const bullet of CONFIG.extraBullets) {
      if (!bullet) continue;
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  lines.push("More info:");
  lines.push(`- Schedule: ${CONFIG.scheduleUrl}`);
  lines.push(`- FAQs: ${CONFIG.faqsUrl}`);
  lines.push(`- Website: ${CONFIG.websiteUrl}`);
  lines.push("");
  lines.push(`Questions? Reply to this email or reach us at ${CONFIG.replyTo}.`);
  lines.push("");
  lines.push("With love,");
  lines.push("Shelvin & Nancy");
  lines.push("");

  return lines.join("\n");
}

function groupByEmail_(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.email || "").trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  const out = [];
  for (const [email, groupRows] of map.entries()) {
    const totalGuests = groupRows.reduce((sum, r) => {
      return sum + (r.adults || 0) + (r.kids515 || 0) + (r.kidsUnder5 || 0);
    }, 0);
    out.push({ email, rows: groupRows, totalGuests });
  }

  out.sort((a, b) => a.email.localeCompare(b.email));
  return out;
}

function readRsvpRows_(sheet, sentColIndex, sentHeader) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const firstRow = values[0] || [];
  const hasHeader = firstRow.some((cell) => String(cell || "").toLowerCase().includes("timestamp")) ||
    firstRow.some((cell) => String(cell || "").toLowerCase() === "name");

  const startRow = hasHeader ? 2 : 1;
  const out = [];

  for (let r = startRow; r <= lastRow; r++) {
    const row = values[r - 1];
    if (!row || row.length < 7) continue;

    const name = String(row[1] || "").trim();
    const attendingRaw = String(row[2] || "").trim().toLowerCase();
    const adults = toInt_(row[3]);
    const kids515 = toInt_(row[4]);
    const kidsUnder5 = toInt_(row[5]);
    const email = String(row[6] || "").trim();
    const sentAt = sentColIndex ? row[sentColIndex - 1] : "";

    if (!name) continue;

    out.push({
      sheet,
      rowIndex: r,
      name,
      attending: attendingRaw === "yes" ? "yes" : "no",
      adults,
      kids515,
      kidsUnder5,
      email: isValidEmail_(email) ? email : "",
      sentAt: sentAt || "",
    });
  }

  return out;
}

function markGroupSent_(group, sentAt, sentHeader) {
  for (const row of group.rows) {
    const sheet = row.sheet;
    const sentCol = ensureSentAtColumn_(sheet, sentHeader);
    sheet.getRange(row.rowIndex, sentCol, 1, 1).setValue(sentAt);
  }
}

function ensureSentAtColumn_(sheet, header) {
  const lastCol = sheet.getLastColumn() || 1;
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = firstRow.findIndex((cell) => String(cell || "").trim() === header);
  if (idx >= 0) return idx + 1;

  // Add header in next column
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol, 1, 1).setValue(header);
  return newCol;
}

function ensureLogSheet_(ss) {
  const name = "Reminder Log";
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["Sent At", "Original Email", "Recipient", "Names", "Total Guests", "Status", "Error"]);
  }
  return sheet;
}

function appendLog_(logSheet, entry) {
  logSheet.appendRow([
    entry.sentAt,
    entry.email,
    entry.recipient,
    entry.names,
    entry.totalGuests,
    entry.status,
    entry.error,
  ]);
}

function getSpreadsheet_() {
  if (CONFIG.spreadsheetId) {
    return SpreadsheetApp.openById(CONFIG.spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function toInt_(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function isValidEmail_(value) {
  if (!value) return false;
  const s = String(value).trim();
  if (!s) return false;
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s);
}


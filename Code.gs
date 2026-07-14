// ─────────────────────────────────────────────────────────
//  BLIEND ATTENDANCE — Google Apps Script backend
//  ONE Google Sheet, TWO tabs. Bind this script to that sheet
//  (Extensions → Apps Script from inside the sheet itself) —
//  no spreadsheet IDs needed, it just uses the file it's attached to.
//
//  1) "Employees"  — admin maintains this manually, this IS the
//                     login master list.
//       Row 1 headers: Employee Code | Name
//       e.g.           BEPL001       | Arun Kumar
//
//  2) "Attendance" — written to automatically by check-in/check-out.
//                     Don't type into it, just read it.
//       Row 1 headers: Date | Name | Employee Code | Check In | Check Out | Status | Total Hours
//
//  SETUP
//  1. Open "Bliend - Attendance" (the sheet with both tabs).
//  2. Extensions → Apps Script.
//  3. Delete whatever's in Code.gs, paste this whole file in, Save (Ctrl+S).
//  4. Deploy → New deployment → gear icon → Web app.
//       Execute as: Me
//       Who has access: Anyone
//     Click Deploy, authorize when prompted, copy the /exec URL.
//  5. Paste that URL into API_URL in the React app's App.jsx.
//  6. In the function dropdown (top, next to Debug), pick
//     createDailyAbsentTrigger and click Run once — installs the
//     nightly Absent sweep (see bottom of this file).
// ─────────────────────────────────────────────────────────

const EMPLOYEES_SHEET  = "Employees";
const ATTENDANCE_SHEET = "Attendance";

// Hour (24h, script timezone) the end-of-day absentee sweep should run at.
// Anyone with no check-in row by this time gets marked Absent. Only used
// by createDailyAbsentTrigger() below — change it, then re-run that
// function once to update the trigger.
const ABSENT_SWEEP_HOUR = 20; // 8 PM

// Optional lightweight guard so randoms can't hit your endpoint.
// Set the same value in the frontend's API_SECRET constant, or leave
// both as "" to disable this check entirely.
const API_SECRET = "";

function doGet(e) {
  return jsonResponse({ status: "success", message: "Bliend Attendance API is live." });
}

function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : "";
    if (!raw) return jsonResponse({ status: "error", message: "No data received" });

    const body = JSON.parse(raw);

    if (API_SECRET && body.secret !== API_SECRET) {
      return jsonResponse({ status: "error", message: "Unauthorized" });
    }

    switch (body.action) {
      case "login":
        return jsonResponse(handleLogin(body));
      case "checkin":
        return jsonResponse(handleCheckIn(body));
      case "checkout":
        return jsonResponse(handleCheckOut(body));
      case "history":
        return jsonResponse(handleHistory(body));
      default:
        return jsonResponse({ status: "error", message: "Unknown action: " + body.action });
    }
  } catch (err) {
    return jsonResponse({ status: "error", message: "Server error: " + err.message });
  }
}

// ── Helpers ────────────────────────────────────────────────

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found — check the tab name.`);
  return sheet;
}

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

// Look up an employee code+name against the manually-maintained Employees
// tab. This is the ONLY source of truth for "is this employee correct or
// incorrect".
function findEmployee(code) {
  const sheet = getSheet(EMPLOYEES_SHEET);
  const data = sheet.getDataRange().getValues(); // [ [Employee Code, Name], ... ]
  const target = String(code).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    const rowCode = String(data[i][0]).trim().toUpperCase();
    if (rowCode === target) {
      return { code: rowCode, name: String(data[i][1]).trim() };
    }
  }
  return null;
}

// Finds today's attendance row for this employee code, if one exists.
// One row per employee per calendar day — this is what makes double
// check-in / double check-out impossible.
function findTodayRow(code) {
  const sheet = getSheet(ATTENDANCE_SHEET);
  const data = sheet.getDataRange().getValues();
  const today = todayStr();
  const target = String(code).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate = Utilities.formatDate(
      new Date(data[i][0]),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
    const rowCode = String(data[i][2]).trim().toUpperCase();
    if (rowDate === today && rowCode === target) {
      return { rowIndex: i + 1, values: data[i] }; // rowIndex is 1-based sheet row
    }
  }
  return null;
}

function getAllEmployees() {
  const sheet = getSheet(EMPLOYEES_SHEET);
  const data = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    out.push({ code: String(data[i][0]).trim().toUpperCase(), name: String(data[i][1]).trim() });
  }
  return out;
}

// Set of employee codes that already have a row for today (present, on
// whatever status), so the absentee sweep doesn't double-write them.
function getTodayCodes() {
  const sheet = getSheet(ATTENDANCE_SHEET);
  const data = sheet.getDataRange().getValues();
  const today = todayStr();
  const codes = new Set();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate = Utilities.formatDate(
      new Date(data[i][0]),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
    if (rowDate === today) codes.add(String(data[i][2]).trim().toUpperCase());
  }
  return codes;
}

// ── Actions ────────────────────────────────────────────────

function handleLogin(body) {
  const code = String(body.code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();

  const emp = findEmployee(code);
  if (!emp) {
    return { status: "error", message: "Employee code not found. Check with admin." };
  }
  if (emp.name.toUpperCase() !== name.toUpperCase()) {
    return { status: "error", message: "Name does not match this employee code." };
  }

  const todayRow = findTodayRow(code);
  const attendance = todayRow
    ? {
        checkIn: todayRow.values[3] ? new Date(todayRow.values[3]).toISOString() : null,
        checkOut: todayRow.values[4] ? new Date(todayRow.values[4]).toISOString() : null,
      }
    : { checkIn: null, checkOut: null };

  return { status: "success", data: { name: emp.name, code: emp.code, attendance } };
}

function handleCheckIn(body) {
  const code = String(body.code || "").trim().toUpperCase();
  const emp = findEmployee(code);
  if (!emp) return { status: "error", message: "Employee code not found." };

  const existing = findTodayRow(code);
  if (existing) {
    return existing.values[4]
      ? { status: "error", message: "Attendance already completed for today." }
      : { status: "error", message: "Already checked in. Check out first." };
  }

  const now = new Date();
  const sheet = getSheet(ATTENDANCE_SHEET);
  sheet.appendRow([now, emp.name, emp.code, now, "", "Present", ""]);

  return { status: "success", data: { checkIn: now.toISOString() } };
}

function handleCheckOut(body) {
  const code = String(body.code || "").trim().toUpperCase();
  const emp = findEmployee(code);
  if (!emp) return { status: "error", message: "Employee code not found." };

  const existing = findTodayRow(code);
  if (!existing) {
    return { status: "error", message: "No check-in found for today. Check in first." };
  }
  if (existing.values[4]) {
    return { status: "error", message: "Already checked out today." };
  }

  const checkInTime = new Date(existing.values[3]);
  const checkOutTime = new Date();
  const totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

  const sheet = getSheet(ATTENDANCE_SHEET);
  sheet.getRange(existing.rowIndex, 5).setValue(checkOutTime); // Check Out
  sheet.getRange(existing.rowIndex, 7).setValue(totalHours.toFixed(2)); // Total Hours

  return {
    status: "success",
    data: { checkOut: checkOutTime.toISOString(), totalHours: totalHours.toFixed(2) },
  };
}

// Returns every attendance row for one employee, oldest to newest —
// this is what powers the calendar on the dashboard.
function handleHistory(body) {
  const code = String(body.code || "").trim().toUpperCase();
  const emp = findEmployee(code);
  if (!emp) return { status: "error", message: "Employee code not found." };

  const sheet = getSheet(ATTENDANCE_SHEET);
  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowCode = String(data[i][2]).trim().toUpperCase();
    if (rowCode !== code) continue;
    records.push({
      date: Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      checkIn: data[i][3] ? new Date(data[i][3]).toISOString() : null,
      checkOut: data[i][4] ? new Date(data[i][4]).toISOString() : null,
      status: data[i][5] || "",
      totalHours: data[i][6] !== "" ? Number(data[i][6]) : null,
    });
  }

  return { status: "success", data: { records } };
}

// ── End-of-day absentee sweep ──────────────────────────────
// There's no admin portal, so "Absent" can't be a manual action — this
// is what fills the gap. It runs on a time trigger (set up once below)
// and writes an Absent row, blank times, 0.00 hours, for every employee
// in the Employees tab who has no Attendance row for today by then.
// Existing rows (Present, mid-shift, or already checked out) are left
// untouched.
function markAbsentees() {
  const today = new Date();
  const employees = getAllEmployees();
  const presentCodes = getTodayCodes();
  const sheet = getSheet(ATTENDANCE_SHEET);

  const absentRows = employees
    .filter((emp) => !presentCodes.has(emp.code))
    .map((emp) => [today, emp.name, emp.code, "", "", "Absent", "0.00"]);

  if (absentRows.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, absentRows.length, absentRows[0].length)
      .setValues(absentRows);
  }
}

// Run this ONCE manually (select it in the function dropdown → Run) to
// install a nightly trigger. Re-run it any time you change
// ABSENT_SWEEP_HOUR — it clears the old trigger first so they don't stack.
function createDailyAbsentTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "markAbsentees")
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("markAbsentees")
    .timeBased()
    .everyDays(1)
    .atHour(ABSENT_SWEEP_HOUR)
    .create();
}

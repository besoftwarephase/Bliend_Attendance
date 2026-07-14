# AttendX — Attendance Maintenance Platform

A no-backend attendance app. Employees log in with their name and employee
code, check in/out, and all activity is tracked in a live dashboard that can
be exported to a real Excel (.xlsx) file at any time.

---

## 1. Requirements

- **Node.js 18 or newer** — check with `node -v`. If you don't have it,
  download from https://nodejs.org (LTS version).
- A code editor is optional — you can run everything from a terminal.

---

## 2. Setup (one-time)

1. Unzip this folder somewhere on your computer.
2. Open a terminal and move into the folder:
   ```bash
   cd attendx-attendance
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
   This downloads React, Vite, Tailwind, the icon library, and **xlsx**
   (SheetJS — the library that generates the Excel export). It creates a
   `node_modules` folder; you only need to do this once (or again if you
   change `package.json`).

---

## 3. Run it

**Development mode** (auto-reloads as you edit files):
```bash
npm run dev
```
This starts a local server, usually at **http://localhost:5173** — your
browser should open automatically. Leave the terminal running while you use
the app; press `Ctrl + C` to stop it.

**Production build** (a fast, static version you can host anywhere):
```bash
npm run build
```
This creates a `dist/` folder with plain HTML/CSS/JS. Preview it locally with:
```bash
npm run preview
```
or upload the `dist/` folder to any static host (Netlify, Vercel, GitHub
Pages, your company intranet, etc.) — no server or database required.

---

## 4. How the app works

- **Login** — validates the Name field (letters/spaces only) and Employee
  Code field (`BEPL001`–`BEPL999`) as you type, showing a tooltip if invalid.
- **Check In / Check Out** — recorded in memory with a live shift-progress
  ring (target: 8 hours), and — if you've connected a file — written straight
  to your Excel file automatically (see below).
- **Dashboard** — shows present-today, currently-checked-in, average hours,
  and total entries, plus a searchable table of every record (Employee Code,
  Name, Login, Logout, Status, Total Hours).
- **Data lifetime** — because there's no backend or database, all records
  live only in the browser tab's memory for that session. **Refreshing the
  page clears them.** Connecting an Excel file (below) is the way to make
  that data durable, since the file itself keeps everything.

---

## 5. Excel integration — how it's set up

The Excel feature uses **[SheetJS (`xlsx`)](https://www.npmjs.com/package/xlsx)**
to build real `.xlsx` workbooks in the browser, combined with the browser's
**File System Access API** to write straight to a file on your computer —
no server, no Microsoft Office install, no macros.

Both are already wired up — `npm install` pulls in `xlsx`, and the File
System Access API is built into the browser itself.

### Automatic mode (recommended) — "Connect Excel file"

At the top of the dashboard there's a **"Connect Excel file"** button.

1. Click it once. Your browser will ask you to pick or create a file —
   choose a name (e.g. `attendance.xlsx`) and a folder.
2. From that point on, **every Check In and every Check Out automatically
   rewrites that file** with the full, current attendance table — Employee
   Code, Name, Login, Logout, Status, and Total Hours — no clicking
   required.
3. The card shows a live "last saved HH:MM:SS" timestamp so you can see it
   working.
4. Click **Disconnect** to stop auto-writing (for example, to switch files).

**Browser support:** this needs the File System Access API, which currently
only works in **Chrome or Edge on desktop** (not Firefox, not Safari, not
mobile browsers). If you're on an unsupported browser, the card will tell
you and the button won't appear — use manual mode instead.

**Re-connecting after a refresh:** because the browser doesn't let websites
silently reopen a file handle after a page reload (for your own security),
you'll need to click "Connect Excel file" again each time you restart the
app. When you reconnect to the *same* file, the next write simply
overwrites it with the current session's data — so it's best to also keep
using "Download a copy" as an occasional backup, or copy data out at the
end of each day if you restart often.

### Manual mode — "Download a copy"

Works in every browser. Click it any time to download a snapshot like
`attendance_2026-07-14.xlsx` to your Downloads folder.

### The code, if you want to see it (in `src/App.jsx`)

```js
import * as XLSX from "xlsx";

// Builds the workbook from the current records
const buildWorkbook = (data) => {
  const rows = data.map((r) => ({
    "Employee Code": r.code,
    Name: r.name,
    Login: r.loginTime ? r.loginTime.toLocaleString() : "",
    Logout: r.logoutTime ? r.logoutTime.toLocaleString() : "",
    Status: r.status,
    "Total Hours": r.totalHours != null ? r.totalHours.toFixed(2) : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  return wb;
};

// Runs automatically whenever records change, IF a file is connected
useEffect(() => {
  if (!fileHandle) return;
  (async () => {
    const wb = buildWorkbook(records);
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const writable = await fileHandle.createWritable();
    await writable.write(wbout);
    await writable.close();
  })();
}, [records, fileHandle]);
```

### If you need it to work in Firefox/Safari or on mobile too

Those browsers don't support the File System Access API at all, so true
automatic file-writing isn't possible there without a backend. The
practical options, in order of effort:
- Keep using **"Download a copy"** on those browsers (already built in).
- Add a small backend endpoint that receives each check-in/check-out and
  appends it to a file on a server or shared drive.
- Sync to Google Sheets or Microsoft Excel Online via their APIs, which
  works from any browser since the writing happens server-side.

Let me know if you'd like help building any of those — happy to take it
further.

---

## 6. Project structure

```
attendx-attendance/
├── index.html            # HTML entry point
├── package.json          # dependencies & scripts
├── vite.config.js        # dev server config
├── tailwind.config.js    # design tokens
├── postcss.config.js     # tailwind/autoprefixer wiring
├── src/
│   ├── main.jsx          # React root
│   ├── App.jsx           # entire app (login + dashboard)
│   └── index.css         # Tailwind + font import
└── README.md             # this file
```

---

## 7. Customizing

- **Colors** — the palette (white / black / grey) is applied via standard
  Tailwind classes (`bg-white`, `text-gray-900`, `border-gray-200`, etc.)
  throughout `src/App.jsx`.
- **Typography** — Inter is loaded via Google Fonts in `src/index.css` and
  set as the default font in `tailwind.config.js`.
- **Shift target** — the 8-hour ring target is set in `App.jsx`:
  `const shiftTargetMs = 8 * 60 * 60 * 1000;` — change `8` to whatever your
  standard shift length is.
- **Employee code range** — validation lives in the `validateCode` function
  in `App.jsx` if you ever need a different code format.

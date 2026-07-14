import React, { useState, useEffect, useMemo } from "react";
import { Check, LogOut, AlertCircle, ArrowRight, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";

/* ---------------------------------------------------------
   Backend config
   Paste your Apps Script Web App /exec URL here once deployed.
   Keep API_SECRET in sync with the one in Code.gs (or leave both "").
--------------------------------------------------------- */
const API_URL = "https://script.google.com/macros/s/AKfycbzr_kZUZSNhEXvFvJvu4GKBWv6xNnPYwMcrolAe2e2RuTZ6k2A8zP9jbDMdrw_GLPA1kw/exec";
const API_SECRET = "";

async function callApi(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    // text/plain avoids a CORS preflight — Apps Script doesn't handle
    // OPTIONS requests, so this content-type keeps it a "simple" request.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, secret: API_SECRET, ...payload }),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message || "Something went wrong");
  return json.data;
}

/* ---------------------------------------------------------
   Validation
--------------------------------------------------------- */
function validateName(raw) {
  const val = raw.trim();
  if (!val) return "Name is required";
  if (!/^[A-Za-z\s]+$/.test(val)) return "Only letters and spaces are allowed";
  if (val.length < 2) return "Name looks too short";
  return "";
}

// function validateCode(raw) {
//   const val = raw.trim().toUpperCase();
//   if (!val) return "Employee code is required";
//   if (!/^\d+$/.test(val)) return "Only numbers are allowed";
//   if (!/^BEPL\d{3}$/.test(val)) return "Use the format BEPL001 to BEPL999";
//   return "";
// }

function validateCode(raw) {
  const val = raw.trim().toUpperCase();

  if (!val) return "Employee code is required";
  if (!/^[A-Z0-9]+$/.test(val))
    return "Only letters and numbers are allowed";
  if (!/^BEPL\d{3}$/.test(val))
    return "Use the format BEPL001 to BEPL999";

  return "";
}

/* ---------------------------------------------------------
   Formatting helpers
--------------------------------------------------------- */
const fmtClock = (d) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtTime = (d) =>
  d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDate = (d) =>
  d.toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short" });

const fmtElapsed = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const fmtHours = (hrs) => {
  if (hrs == null) return "—";
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
};

/* ---------------------------------------------------------
   Small building blocks
--------------------------------------------------------- */
function FieldInput({  label,value,onChange,error,placeholder,onEnter,autoFocus,maxLength,onlyCharacters = false,alphaNumeric = false }) {
  const [touched, setTouched] = useState(false);
  const showError = touched && error;
  return (
    <div className="relative mb-6">
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </label>
      <input
        autoFocus={autoFocus}
        value={value}
        maxLength={maxLength}
        // onChange={(e) => {
        //   setTouched(true);
        //   onChange(e.target.value);
        // }}
        onChange={(e) => {
          setTouched(true);

          let input = e.target.value;

          if (onlyCharacters) {
            input = input.replace(/[^a-zA-Z\s]/g, "");
          }

          if (alphaNumeric) {
            input = input
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
          }

          onChange(input);
        }}
        onBlur={() => setTouched(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400
          ${showError ? "border-gray-900" : "border-gray-200 focus:border-gray-900"}`}
      />
      {showError && (
        // <div className="absolute left-0 top-full mt-1.5 z-10 flex items-start gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
        //   <AlertCircle size={13} className="mt-0.5 shrink-0" />
        //   <span>{error}</span>
        // </div>
         <div className="absolute left-0 top-full mt-1.5 z-10 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
          <AlertCircle
            size={13}
            className="mt-0.5 shrink-0 text-red-700"
          />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* Shift progress ring */
function ShiftRing({ progress, elapsedLabel, subLabel }) {
  const size = 176;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, progress));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#0A2540"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">
          {elapsedLabel}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-wider text-gray-400">{subLabel}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Login Screen — validates against the Employees sheet via API
--------------------------------------------------------- */
function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const nameError = validateName(name);
  const codeError = validateCode(code);
  const canSubmit = !nameError && !codeError;

  const submit = async () => {
    setAttempted(true);
    setApiError("");
    if (!canSubmit || submitting) return;

    const trimmedName = name.trim().replace(/\s+/g, " ");
    const trimmedCode = code.trim().toUpperCase();

    setSubmitting(true);
    try {
      const data = await callApi("login", { name: trimmedName, code: trimmedCode });
      onLogin({
        name: data.name,
        code: data.code,
        logIn: data.attendance.logIn ? new Date(data.attendance.logIn) : null,
        logOut: data.attendance.logOut ? new Date(data.attendance.logOut) : null,
      });
    } catch (err) {
      // Server told us the code/name combo is wrong — this is the
      // "employee is correct or incorrect" check, done server-side
      // against the Employees master sheet.
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dotted-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/Bliend_b_logo_header.svg"
            alt="Bliend"
            className="mx-auto mb-5 h-9 w-auto"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Bliend Attendance Management
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">Sign in to mark today's attendance</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <FieldInput
            label="Full name"
            value={name}
            onChange={setName}
            error={nameError}
            placeholder="e.g. Arun Kumar"
            autoFocus
          />
          <FieldInput
            
            label="Employee code"
            value={code}
            onChange={setCode}
            error={codeError}
            placeholder="e.g. BEPL045"
            maxLength={7}
            alphaNumeric
            onEnter={submit}
          />

          <button
            onClick={submit}
            disabled={submitting}
            className="mt-14 w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                Continue to attendance
                <ArrowRight size={15} />
              </>
            )}
          </button>

          {attempted && !canSubmit && (
            <p className="mt-3 text-center text-xs text-gray-400">
              Check the fields above — both name and employee code need to be valid.
            </p>
          )}
          {apiError && (
            <p className="mt-3 text-center text-xs font-medium text-red-600">{apiError}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          {/* Valid codes range from BEPL001 to BEPL999 */}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Attendance Calendar — interactive month view of the logged-in
   employee's own history. Data comes from the "history" action,
   which reads every Attendance row matching their code.
--------------------------------------------------------- */
const STATUS_STYLE = {
  Present: "bg-green-600 text-white",
  Absent: "bg-red-600 text-red-600 border border-red-200",
};

function AttendanceCalendar({ records, loading }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selected, setSelected] = useState(null);

  const byDate = useMemo(() => {
    const map = {};
    records.forEach((r) => (map[r.date] = r));
    return map;
  }, [records]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = cursor.toLocaleDateString([], { month: "long", year: "numeric" });

  const dateKey = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const changeMonth = (delta) => {
    setSelected(null);
    setCursor((c) => {
      const n = new Date(c);
      n.setMonth(n.getMonth() + delta);
      return n;
    });
  };

  const selectedRecord = selected ? byDate[selected] : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Your attendance</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="w-32 text-center text-xs font-medium text-gray-600">{monthLabel}</span>
          <button
            onClick={() => changeMonth(1)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 size={18} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium uppercase text-gray-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const key = dateKey(d);
              const rec = byDate[key];
              const isToday = key === todayStr;
              const isFuture = key > todayStr;
              const isSelected = key === selected;

              let cls = "bg-gray-50 text-gray-300"; // no record, past or future
              if (rec && STATUS_STYLE[rec.status]) cls = STATUS_STYLE[rec.status];
              else if (!isFuture && key !== todayStr) cls = "bg-gray-50 text-gray-400";

              return (
                <button
                  key={i}
                  disabled={!rec}
                  onClick={() => setSelected(rec ? key : null)}
                  className={`relative aspect-square rounded-lg text-xs font-medium flex items-center justify-center transition-all
                    ${cls}
                    ${isToday ? "ring-2 ring-offset-1 ring-red-900" : ""}
                    ${isSelected ? "scale-90" : ""}
                    ${rec ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 border border-red-300" /> Absent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-200" /> No record
            </span>
          </div>

          {selectedRecord && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-900">
                  {new Date(selected + "T00:00:00").toLocaleDateString([], {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
                {selectedRecord.status === "Absent" ? (
                  <p className="mt-1 text-xs text-red-600">Marked absent — no check-in recorded.</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    In {fmtTime(selectedRecord.logIn ? new Date(selectedRecord.logIn) : null)} · Out{" "}
                    {fmtTime(selectedRecord.logOut ? new Date(selectedRecord.logOut) : null)} ·{" "}
                    {fmtHours(selectedRecord.totalHours)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Dashboard — check in / check out only. No admin table here;
   admin reviews everyone's attendance directly in the Google Sheet.
--------------------------------------------------------- */
function Dashboard({ user, setUser, onLogout }) {
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await callApi("history", { code: user.code });
      setHistory(data.records);
    } catch (err) {
      // Non-fatal — the calendar just stays empty. Check-in/out still work.
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.code]);

  const isCheckedIn = !!user.logIn && !user.logOut;
  const isDone = !!user.logIn && !!user.logOut;

  const elapsedMs = isCheckedIn ? now - user.logIn : 0;
  const shiftTargetMs = 8 * 60 * 60 * 1000;
  const progress = isCheckedIn ? elapsedMs / shiftTargetMs : 0;

  const totalHours = useMemo(() => {
    if (!user.logIn || !user.logOut) return null;
    return (user.logOut - user.logIn) / (1000 * 60 * 60);
  }, [user.logIn, user.logOut]);

  const handlelogIn = async () => {
    if (isCheckedIn || isDone || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const data = await callApi("logIn", { code: user.code });
      setUser((u) => ({ ...u, logIn: new Date(data.logIn), logOut: null }));
      loadHistory();
    } catch (err) {
      // Server enforces "no double check-in" — if this fires, someone
      // already checked in today (e.g. from another tab/device).
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlelogOut = async () => {
    if (!isCheckedIn || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const data = await callApi("logOut", { code: user.code });
      setUser((u) => ({ ...u, logOut: new Date(data.logOut) }));
      loadHistory();
    } catch (err) {
      // Server enforces "no double check-out" the same way.
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Bliend_b_logo_header.svg" alt="Bliend" className="h-7 w-auto" />
            <div className="hidden sm:block">
              <p className="text-[11px] text-gray-400 -mt-0.5"></p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <span>{fmtDate(now)}</span>
            <span className="text-gray-300">·</span>
            <span className="tabular-nums">{fmtClock(now)}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-[11px] text-gray-400">{user.code}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 flex flex-col sm:flex-row items-center gap-8">
          <ShiftRing
            progress={progress}
            elapsedLabel={isCheckedIn ? fmtElapsed(elapsedMs) : "00:00:00"}
            subLabel={isDone ? "shift completed" : isCheckedIn ? "of 8h shift" : "not checked in"}
          />

          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {isDone ? "Today's shift is done" : isCheckedIn ? "Currently checked in" : "Ready when you are"}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
              {isDone
                ? `Checked out at ${fmtTime(user.logOut)}`
                : isCheckedIn
                ? `Checked in at ${fmtTime(user.logIn)}`
                : `Mark attendance for ${user.name.split(" ")[0]}`}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isDone
                ? `Total time logged: ${fmtHours(totalHours)}. See you tomorrow.`
                : isCheckedIn
                ? "Your hours are being tracked. Check out once your shift ends."
                : "Press check in to start logging your shift."}
            </p>

            <div className="mt-5 flex items-center justify-center sm:justify-start gap-3">
              <button
                onClick={handlelogIn}
                disabled={isCheckedIn || isDone || busy}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                {busy && !isCheckedIn ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Login
              </button>
              <button
                onClick={handlelogOut}
                disabled={!isCheckedIn || busy}
                className="flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              >
                {busy && isCheckedIn ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Log out
              </button>
            </div>

            {actionError && (
              <p className="mt-3 text-xs font-medium text-red-600">{actionError}</p>
            )}
          </div>
        </div>

        <AttendanceCalendar records={history} loading={historyLoading} />

        <p className="mt-4 text-center text-xs text-gray-400">
          Every check-in and check-out is written straight to the Bliend attendance sheet.
        </p>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   Root App
--------------------------------------------------------- */
export default function App() {
  const [user, setUser] = useState(null);

  return !user ? (
    <LoginScreen onLogin={setUser} />
  ) : (
    <Dashboard user={user} setUser={setUser} onLogout={() => setUser(null)} />
  );
}

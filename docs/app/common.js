/* Shared pieces used by every tab: the saved event list and small helpers.
   Loaded first. Every file in this folder shares one global scope, so a
   function defined here (like addEvent) can be called from any other file.
   Falak Ameesh Patel. PolyForm Noncommercial 1.0.0 */
"use strict";

// The label format (CTDE1) lives in ../codec.js. See that file for the details.
const FIELDS = CTDE.FIELDS;            // ["sid", "cage", "drug", "dose", "unit", "route", "op"]
const encodeEvent = CTDE.encodeEvent;  // form fields -> "CTDE1|...|..." text
const decodeEvent = CTDE.decodeEvent;  // "CTDE1|...|..." text -> form fields

// ---------------------------------------------------------------- saved events
// Every captured event is kept in the browser's localStorage, so the log
// survives a page reload. Nothing is ever sent to a server.
const STORAGE_KEY = "ctde.events.v1";
let events = [];

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    events = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(events)) events = [];
  } catch (e) {
    events = [];   // private mode, blocked storage, or bad JSON: start empty
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    // Storage full or blocked: the app still works, it just won't remember.
  }
}

// Adds one event to the log. `source` is how it was captured: "manual", "qr" or "nfc".
function addEvent(rec, source) {
  const row = { ts: new Date().toISOString(), source: source };
  FIELDS.forEach(function (f) { row[f] = rec[f] || ""; });
  events.push(row);
  saveStore();
  renderLog();   // in log.js
  return row;
}

// ---------------------------------------------------------------- helpers
// $("#id") finds one element on the page.
function $(selector) { return document.querySelector(selector); }

// Makes text safe to put inside HTML (so a "<" in a drug name can't break the page).
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

// Saves some text as a file on the user's device.
function download(name, mime, text) {
  saveBlob(name, new Blob([text], { type: mime }));
}

function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// A one-line summary of an event, e.g. "S-014 · Drug X · 5 mg · oral".
function describe(rec) {
  const dose = [rec.dose, rec.unit].filter(Boolean).join(" ");
  return [rec.sid, rec.drug, dose, rec.route].filter(Boolean).join(" · ");
}

// A short buzz on phones, so the user knows a capture worked.
function feedback() {
  if (navigator.vibrate) {
    try { navigator.vibrate(40); } catch (e) {}
  }
}

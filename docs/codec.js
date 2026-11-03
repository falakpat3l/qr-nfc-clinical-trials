/* CTDE1: Clinical Trial Dosing Event, version 1.
 *
 * A dosing event is encoded as pipe-delimited plain text:
 *
 *     CTDE1|subject|cage|drug|dose|unit|route|operator
 *
 * Plain text, not a URL: a label that resolves to a server is useless in an
 * animal house with no signal, and a label that phones home is a privacy
 * problem nobody asked for.
 *
 * Delimited, not JSON: QR capacity is small enough that JSON's punctuation is
 * a real cost at this size, and the field list is fixed.
 *
 * Every field is percent-encoded, so a pipe inside a value cannot split the
 * record. "CTDE1" is a version marker: a later CTDE2 may change the field
 * list without old and new labels ever being mistaken for one another.
 *
 * This file is deliberately standalone and dependency-free. It is the part of
 * the system that would have to be agreed between sites for labels made by one
 * group to be readable by another.
 *
 * Loads as a plain <script> (defines window.CTDE) or via require() in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CTDE = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEME = "CTDE1";
  var FIELDS = ["sid", "cage", "drug", "dose", "unit", "route", "op"];

  // A scanned code or tapped tag is untrusted input: anyone can print a QR.
  // These limits match the form in app.html, so every label the app makes
  // passes, and anything bigger or stranger is turned away before it is logged.
  var MAX_LEN = { sid: 64, cage: 64, drug: 80, dose: 12, unit: 16, route: 16, op: 32 };
  // The longest label the app can make: every field full of characters that
  // percent-encode to 9 letters each (most non-Latin scripts). Checked on the
  // raw text before it is split, so a huge tag is rejected cheaply.
  var MAX_PAYLOAD = SCHEME.length + FIELDS.length + 9 * FIELDS.reduce(function (n, f) {
    return n + MAX_LEN[f];
  }, 0);
  var NAMES = { sid: "Subject", cage: "Cage", drug: "Drug", dose: "Dose",
                unit: "Unit", route: "Route", op: "Operator" };
  // Control characters (tabs, line breaks, NUL) and the invisible marks that
  // flip text direction, which can make a value display as something it is not.
  var BAD_CHARS = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
  var NUMBER = /^(\d+\.?\d*|\.\d+)$/;

  // Checks an event. Returns "" when it is fine, or a sentence saying what to fix.
  function validateEvent(rec) {
    if (rec == null || typeof rec !== "object") return "Not a dosing event.";
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      var v = rec[f] == null ? "" : rec[f];
      if (typeof v !== "string") return NAMES[f] + " must be text.";
      if (v.length > MAX_LEN[f]) {
        return NAMES[f] + " is too long (at most " + MAX_LEN[f] + " characters).";
      }
      if (BAD_CHARS.test(v)) return NAMES[f] + " contains hidden or control characters.";
    }
    if (!rec.sid) return "Subject or animal ID is missing.";
    if (rec.dose && !NUMBER.test(rec.dose)) {
      return "Dose must be a number, like 10 or 2.5 (use a dot for decimals).";
    }
    return "";
  }

  function encodeEvent(rec) {
    if (rec == null || typeof rec !== "object") {
      throw new TypeError("encodeEvent expects a record object");
    }
    return SCHEME + "|" + FIELDS.map(function (f) {
      return encodeURIComponent(rec[f] == null ? "" : String(rec[f]));
    }).join("|");
  }

  function decodeEvent(text) {
    // Trim, because NFC text records and some scanners add a trailing newline.
    var raw = String(text == null ? "" : text).trim();
    if (raw.length > MAX_PAYLOAD) {
      throw new Error("Code is too long to be a dosing event");
    }
    var parts = raw.split("|");
    if (parts[0] !== SCHEME) {
      throw new Error("Not a dosing-event code (expected " + SCHEME + ")");
    }
    if (parts.length !== FIELDS.length + 1) {
      throw new Error("Wrong field count: got " + (parts.length - 1) +
                      ", expected " + FIELDS.length);
    }
    var rec = {};
    FIELDS.forEach(function (f, i) {
      try {
        rec[f] = decodeURIComponent(parts[i + 1]);
      } catch (e) {
        // A stray "%" (hand-made or damaged label) makes decodeURIComponent
        // throw a cryptic "URI malformed". Say which field is broken instead.
        throw new Error("Field \"" + f + "\" is not encoded correctly");
      }
    });
    var problem = validateEvent(rec);
    if (problem) throw new Error(problem.replace(/\.$/, ""));
    return rec;
  }

  return { SCHEME: SCHEME, FIELDS: FIELDS, MAX_LEN: MAX_LEN, MAX_PAYLOAD: MAX_PAYLOAD,
           encodeEvent: encodeEvent, decodeEvent: decodeEvent,
           validateEvent: validateEvent };
});

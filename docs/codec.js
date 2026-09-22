/* CTDE1 — Clinical Trial Dosing Event, version 1.
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
 * record. "CTDE1" is a version marker — a later CTDE2 may change the field
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

  function encodeEvent(rec) {
    if (rec == null || typeof rec !== "object") {
      throw new TypeError("encodeEvent expects a record object");
    }
    return SCHEME + "|" + FIELDS.map(function (f) {
      return encodeURIComponent(rec[f] == null ? "" : String(rec[f]));
    }).join("|");
  }

  function decodeEvent(text) {
    var parts = String(text).split("|");
    if (parts[0] !== SCHEME) {
      throw new Error("Not a dosing-event code (expected " + SCHEME + ")");
    }
    if (parts.length !== FIELDS.length + 1) {
      throw new Error("Wrong field count: got " + (parts.length - 1) +
                      ", expected " + FIELDS.length);
    }
    var rec = {};
    FIELDS.forEach(function (f, i) {
      rec[f] = decodeURIComponent(parts[i + 1]);
    });
    return rec;
  }

  return { SCHEME: SCHEME, FIELDS: FIELDS,
           encodeEvent: encodeEvent, decodeEvent: decodeEvent };
});

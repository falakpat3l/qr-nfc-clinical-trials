/* Log tab: the table of everything captured, plus CSV / JSON export and Clear. */
"use strict";

// Redraws the table (newest first, at most 200 rows on screen).
function renderLog() {
  $("#log-count").textContent = events.length + (events.length === 1 ? " record" : " records");
  ["#log-csv", "#log-json", "#log-clear"].forEach(function (id) {
    $(id).disabled = !events.length;
  });
  if (!events.length) {
    $("#log-table").innerHTML =
      '<div class="empty"><p><strong>Nothing captured yet.</strong></p>' +
      '<p class="muted">Scan a label, tap a tag, or press <em>Log this event</em> on the ' +
      "Generate tab. Records appear here, newest first.</p></div>";
    return;
  }
  const rows = events.slice().reverse().slice(0, 200).map(function (e) {
    const when = new Date(e.ts);
    return "<tr><td>" + esc(isNaN(when) ? e.ts : when.toLocaleString()) + "</td><td>" +
           esc(e.source) + "</td><td>" + esc(e.sid) + "</td><td>" +
           esc(e.cage) + "</td><td>" + esc(e.drug) + "</td><td class='num'>" +
           esc([e.dose, e.unit].filter(Boolean).join(" ")) + "</td><td>" + esc(e.route) +
           "</td><td>" + esc(e.op) + "</td></tr>";
  }).join("");
  $("#log-table").innerHTML =
    '<div class="table-scroll" tabindex="0" role="region" aria-label="Captured events">' +
    "<table><thead><tr><th>Time</th><th>Via</th><th>Subject</th><th>Cage</th>" +
    "<th>Drug</th><th>Dose</th><th>Route</th><th>By</th></tr></thead><tbody>" +
    rows + "</tbody></table></div>" +
    (events.length > 200
      ? '<p class="note">Showing the 200 most recent. The export contains all ' + events.length + ".</p>"
      : "");
}

// One CSV cell: wrapped in quotes if it contains a comma, quote or line break.
// A cell starting with = + - or @ would run as a formula in Excel, and a label
// from someone else could carry one, so those get a leading apostrophe
// (plain numbers like -5 are left alone).
function csvCell(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Today's date as YYYY-MM-DD, for file names.
function stamp() {
  const d = new Date();
  const two = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}

$("#log-csv").addEventListener("click", function () {
  if (!events.length) return;
  const cols = ["ts", "source"].concat(FIELDS);
  const lines = [cols.join(",")].concat(events.map(function (e) {
    return cols.map(function (c) { return csvCell(e[c]); }).join(",");
  }));
  // The BOM makes Excel read the file as UTF-8, so "µg" doesn't turn into "Âµg".
  download("capture-log-" + stamp() + ".csv", "text/csv;charset=utf-8",
           "﻿" + lines.join("\r\n") + "\r\n");
});

$("#log-json").addEventListener("click", function () {
  if (!events.length) return;
  download("capture-log-" + stamp() + ".json", "application/json", JSON.stringify(events, null, 2));
});

$("#log-clear").addEventListener("click", function () {
  if (!events.length) return;
  if (!window.confirm("Delete all " + events.length +
                      " captured records from this browser? This cannot be undone.")) return;
  events = [];
  saveStore();
  renderLog();
});

/* Log tab: the table of everything captured, plus CSV / JSON export and Clear. */
"use strict";

// Redraws the table (newest first, at most 200 rows on screen).
function renderLog() {
  $("#log-count").textContent = events.length;
  if (!events.length) {
    $("#log-table").innerHTML = '<p class="muted">Nothing captured yet.</p>';
    return;
  }
  const rows = events.slice().reverse().slice(0, 200).map(function (e) {
    return "<tr><td>" + esc(new Date(e.ts).toLocaleString()) + "</td><td>" +
           esc(e.source) + "</td><td>" + esc(e.sid) + "</td><td>" +
           esc(e.cage) + "</td><td>" + esc(e.drug) + "</td><td class='num'>" +
           esc(e.dose) + " " + esc(e.unit) + "</td><td>" + esc(e.route) +
           "</td><td>" + esc(e.op) + "</td></tr>";
  }).join("");
  $("#log-table").innerHTML =
    "<table><thead><tr><th>Time</th><th>Via</th><th>Subject</th><th>Cage</th>" +
    "<th>Drug</th><th>Dose</th><th>Route</th><th>By</th></tr></thead><tbody>" +
    rows + "</tbody></table>" +
    (events.length > 200
      ? '<p class="note">Showing the 200 most recent. The export contains all ' + events.length + ".</p>"
      : "");
}

// One CSV cell: wrapped in quotes if it contains a comma, quote or new line.
function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

$("#log-csv").addEventListener("click", function () {
  const cols = ["ts", "source"].concat(FIELDS);
  const lines = [cols.join(",")].concat(events.map(function (e) {
    return cols.map(function (c) { return csvCell(e[c]); }).join(",");
  }));
  download("capture-log.csv", "text/csv;charset=utf-8", lines.join("\n"));
});

$("#log-json").addEventListener("click", function () {
  download("capture-log.json", "application/json", JSON.stringify(events, null, 2));
});

$("#log-clear").addEventListener("click", function () {
  if (!events.length) return;
  if (!window.confirm("Delete all " + events.length +
                      " captured records from this browser? This cannot be undone.")) return;
  events = [];
  saveStore();
  renderLog();
});

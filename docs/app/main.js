/* Loaded last: switches between tabs, then starts the app. */
"use strict";

// Tab buttons: show the chosen tab, hide the rest. Leaving Scan turns the
// camera off, and leaving NFC stops listening for tags.
const tabButtons = Array.from(document.querySelectorAll("nav.tabs button"));

function showTab(btn) {
  tabButtons.forEach(function (b) {
    const on = b === btn;
    b.setAttribute("aria-current", on ? "true" : "false");
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;   // only the open tab is in the Tab order; arrows move between them
    $("#tab-" + b.dataset.tab).hidden = !on;
  });
  if (btn.dataset.tab !== "scan") stopScan();          // scan.js
  if (btn.dataset.tab !== "nfc") stopNfc(true);        // nfc.js
  if (btn.dataset.tab === "benchmark") renderChart();  // benchmark.js
}

tabButtons.forEach(function (btn, i) {
  btn.tabIndex = btn.getAttribute("aria-selected") === "true" ? 0 : -1;
  btn.addEventListener("click", function () { showTab(btn); });
  // Left and Right arrows (and Home / End) move between tabs, as screen readers expect.
  btn.addEventListener("keydown", function (e) {
    let next = null;
    if (e.key === "ArrowRight") next = tabButtons[(i + 1) % tabButtons.length];
    else if (e.key === "ArrowLeft") next = tabButtons[(i - 1 + tabButtons.length) % tabButtons.length];
    else if (e.key === "Home") next = tabButtons[0];
    else if (e.key === "End") next = tabButtons[tabButtons.length - 1];
    if (!next) return;
    e.preventDefault();
    showTab(next);
    next.focus();
  });
});

// Start up: load saved events, then draw the QR, the log and the chart.
loadStore();
renderQR();
renderLog();
renderChart();

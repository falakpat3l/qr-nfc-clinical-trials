/* Loaded last: switches between tabs, then starts the app. */
"use strict";

// Tab buttons: show the chosen tab, hide the rest. Leaving Scan turns the
// camera off, and leaving NFC stops listening for tags.
const tabButtons = Array.from(document.querySelectorAll("nav.tabs button"));
tabButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    tabButtons.forEach(function (b) {
      const on = b === btn;
      b.setAttribute("aria-current", on ? "true" : "false");
      b.setAttribute("aria-selected", on ? "true" : "false");
      $("#tab-" + b.dataset.tab).hidden = !on;
    });
    if (btn.dataset.tab !== "scan") stopScan();          // scan.js
    if (btn.dataset.tab !== "nfc") stopNfc();            // nfc.js
    if (btn.dataset.tab === "benchmark") renderChart();  // benchmark.js
  });
});

// Start up: load saved events, then draw the QR, the log and the chart.
loadStore();
renderQR();
renderLog();
renderChart();

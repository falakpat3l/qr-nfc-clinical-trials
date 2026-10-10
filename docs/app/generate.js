/* Generate tab: fill in the form, get a QR label to print or download.
   The QR redraws on every keystroke. */
"use strict";

const genForm = $("#gen-form");
let lastQR = null;   // the QR currently on screen: { canvas, rec, payload }

// Reads the form into an event object: { sid: "...", cage: "...", ... }
function currentRecord() {
  const rec = {};
  FIELDS.forEach(function (f) {
    const el = genForm.elements[f];
    rec[f] = el ? el.value.trim() : "";
  });
  return rec;
}

// Turns the form into label text, then draws that text as a QR code.
function renderQR() {
  const rec = currentRecord();
  const payload = encodeEvent(rec);
  $("#gen-payload").textContent = payload;

  const qr = qrcode(0, "M");   // 0 = pick the size automatically; "M" = medium error correction
  qr.addData(payload);
  qr.make();

  // Draw it square by square: each QR "module" is a 6 px square, with a
  // 4-module white border (scanners need that quiet zone).
  const count = qr.getModuleCount();
  const cell = 6, margin = 4;
  const size = (count + margin * 2) * cell;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.style.width = Math.min(size, 280) + "px";
  canvas.style.height = Math.min(size, 280) + "px";
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + margin) * cell, (row + margin) * cell, cell, cell);
      }
    }
  }

  const out = $("#qr-out");
  out.innerHTML = "";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "QR code for " + describe(rec));
  out.appendChild(canvas);
  lastQR = { canvas: canvas, rec: rec, payload: payload };
}

genForm.addEventListener("input", renderQR);
genForm.addEventListener("submit", function (e) { e.preventDefault(); });

// "Download PNG" button
$("#gen-png").addEventListener("click", function () {
  if (!lastQR) return;
  const fileName = "label-" + (lastQR.rec.sid || "event").replace(/[^\w.-]+/g, "_") + ".png";
  lastQR.canvas.toBlob(function (blob) { saveBlob(fileName, blob); });
});

// "Print" button: opens a small window with just the label, then prints it.
$("#gen-print").addEventListener("click", function () {
  if (!lastQR) return;
  const w = window.open("", "_blank", "width=420,height=560");
  if (!w) {
    window.alert("The print window was blocked. Allow popups for this page, " +
                 "or use Download PNG and print that.");
    return;
  }
  w.document.write(
    '<!doctype html><title>Label</title>' +
    '<style>body{font:14px/1.4 "Times New Roman",Times,serif;text-align:center;' +
    'margin:24px}img{width:230px;image-rendering:pixelated}p{margin:8px 0 0}</style>' +
    '<img src="' + lastQR.canvas.toDataURL("image/png") + '" alt="">' +
    "<p>" + esc(describe(lastQR.rec)) + "</p>" +
    "<p>" + esc(lastQR.rec.cage || "") + "</p>"
  );
  w.document.close();
  w.focus();
  setTimeout(function () { w.print(); }, 250);
});

// "Log it" button: record the event straight from the form, no scan needed.
$("#gen-log").addEventListener("click", function () {
  addEvent(currentRecord(), "manual");
  feedback();
});

/* Generate tab: fill in the form, get a QR label to print or download.
   The QR redraws on every keystroke. */
"use strict";

const genForm = $("#gen-form");
let lastQR = null;   // the QR currently on screen: { canvas, rec, payload }, or null if the form is invalid

// Reads the form into an event object: { sid: "...", cage: "...", ... }
function currentRecord() {
  const rec = {};
  FIELDS.forEach(function (f) {
    const el = genForm.elements[f];
    rec[f] = el ? el.value.trim() : "";
  });
  return rec;
}

// Turns on or off the buttons that need a valid label.
function genButtons(ok) {
  $("#gen-print").disabled = !ok;
  $("#gen-png").disabled = !ok;
  $("#gen-log").disabled = !ok;
}

// Marks the field the problem is in, so it gets a red border.
function markInvalid(problem) {
  genForm.elements.sid.setAttribute("aria-invalid", problem && /subject/i.test(problem) ? "true" : "false");
  genForm.elements.dose.setAttribute("aria-invalid", problem && /dose/i.test(problem) ? "true" : "false");
}

// Turns the form into label text, then draws that text as a QR code.
function renderQR() {
  const rec = currentRecord();
  const out = $("#qr-out");
  let problem = validateRecord(rec);
  let qr = null, payload = "";

  if (!problem) {
    payload = encodeEvent(rec);
    try {
      qr = qrcode(0, "M");   // 0 = pick the size automatically; "M" = medium error correction
      qr.addData(payload);
      qr.make();
    } catch (e) {
      problem = "This is too much text for one label. Shorten some fields.";
    }
  }

  markInvalid(problem);
  if (problem) {
    lastQR = null;
    genButtons(false);
    say("#gen-msg", problem, "err");
    out.innerHTML = '<div class="qr-empty">The label appears here once the form is filled in.</div>';
    $("#gen-payload").textContent = "";
    return;
  }
  genButtons(true);
  say("#gen-msg", "");
  $("#gen-payload").textContent = payload;

  // Draw it square by square: each QR "module" is a 6 px square, with a
  // 4-module white border (scanners need that quiet zone).
  const count = qr.getModuleCount();
  const cell = 6, margin = 4;
  const size = (count + margin * 2) * cell;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.style.width = Math.min(size, 240) + "px";
  canvas.style.height = Math.min(size, 240) + "px";
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

  out.innerHTML = "";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "QR code for " + describe(rec));
  out.appendChild(canvas);
  lastQR = { canvas: canvas, rec: rec, payload: payload };
}

genForm.addEventListener("input", renderQR);
genForm.addEventListener("change", renderQR);   // selects, and autofill that skips "input"
genForm.addEventListener("submit", function (e) { e.preventDefault(); });

// "Download PNG" button
$("#gen-png").addEventListener("click", function () {
  if (!lastQR) return;
  const fileName = "label-" + (lastQR.rec.sid || "event").replace(/[^\w.-]+/g, "_") + ".png";
  lastQR.canvas.toBlob(function (blob) {
    if (blob) saveBlob(fileName, blob);
    else say("#gen-msg", "Could not make the PNG in this browser. Try Print instead.", "err");
  });
});

// "Print" button: opens a small window with just the label, then prints it.
$("#gen-print").addEventListener("click", function () {
  if (!lastQR) return;
  const w = window.open("", "_blank", "width=420,height=560");
  if (!w) {
    say("#gen-msg", "The print window was blocked. Allow pop-ups for this page, " +
                    "or use Download PNG and print that.", "err");
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

// "Log this event" button: record the event straight from the form, no scan needed.
$("#gen-log").addEventListener("click", function () {
  const rec = currentRecord();
  const problem = validateRecord(rec);
  if (problem) { say("#gen-msg", problem, "err"); return; }
  const row = addEvent(rec, "manual");
  feedback();
  say("#gen-msg", "Logged " + rec.sid + " at " + new Date(row.ts).toLocaleTimeString() +
      ". " + events.length + (events.length === 1 ? " record" : " records") + " in the log.", "ok");
});

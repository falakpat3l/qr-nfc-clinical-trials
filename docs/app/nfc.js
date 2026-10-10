/* NFC tab: read and write dosing events on NFC tags.
   Uses Web NFC, which today only exists in Chrome on Android. */
"use strict";

const NFC_SUPPORTED = typeof window.NDEFReader !== "undefined";
let nfcAbort = null;   // lets the Stop button cancel a scan in progress

$("#nfc-support").textContent = NFC_SUPPORTED
  ? ""
  : "Web NFC is not available in this browser. Today that means it works in " +
    "Chrome on Android and nowhere else: iOS exposes no web NFC API at all. " +
    "The QR tabs work everywhere.";
if (!NFC_SUPPORTED) {
  $("#nfc-read").disabled = true;
  $("#nfc-write").disabled = true;
}

function nfcMsg(text) { $("#nfc-msg").textContent = text || ""; }

// "Read tag": wait for a tag, take its first text record, decode it, log it.
$("#nfc-read").addEventListener("click", function () {
  if (!NFC_SUPPORTED) return;
  nfcMsg("Hold a tag against the back of the phone…");
  try {
    const reader = new NDEFReader();
    nfcAbort = new AbortController();
    $("#nfc-stop").disabled = false;
    reader.scan({ signal: nfcAbort.signal }).then(function () {
      reader.onreadingerror = function () { nfcMsg("Could not read that tag."); };
      reader.onreading = function (ev) {
        const decoder = new TextDecoder();
        let text = null;
        for (const record of ev.message.records) {
          if (record.recordType === "text") {
            text = decoder.decode(record.data);
            break;
          }
        }
        if (text == null) { nfcMsg("Tag holds no text record."); return; }

        let rec;
        try { rec = decodeEvent(text); }
        catch (e) { nfcMsg("Tag read, but: " + e.message); return; }

        const row = addEvent(rec, "nfc");
        feedback();
        nfcMsg("");
        $("#nfc-last").innerHTML =
          "<h3>Logged</h3><p>" + esc(describe(rec)) + "<br>" +
          '<span class="muted"><small>' + esc(new Date(row.ts).toLocaleTimeString()) +
          " · tag " + esc(ev.serialNumber || "n/a") + "</small></span></p>";
      };
    }).catch(function (e) { nfcMsg("Scan failed: " + e.message); });
  } catch (e) {
    nfcMsg("Scan failed: " + e.message);
  }
});

// "Write tag": write the event currently in the Generate form onto a tag.
$("#nfc-write").addEventListener("click", function () {
  if (!NFC_SUPPORTED) return;
  const payload = encodeEvent(currentRecord());   // currentRecord() is in generate.js
  nfcMsg("Hold a writable tag against the back of the phone…");
  try {
    const writer = new NDEFReader();
    writer.write({ records: [{ recordType: "text", data: payload }] })
      .then(function () { feedback(); nfcMsg("Written to tag."); })
      .catch(function (e) { nfcMsg("Write failed: " + e.message); });
  } catch (e) {
    nfcMsg("Write failed: " + e.message);
  }
});

// Stops a running tag scan. `quiet` = don't show "Stopped." (used on page close).
function stopNfc(quiet) {
  if (nfcAbort) {
    try { nfcAbort.abort(); } catch (e) {}
    nfcAbort = null;
    if (!quiet) nfcMsg("Stopped.");
  }
  const stopButton = $("#nfc-stop");
  if (stopButton) stopButton.disabled = true;
}

$("#nfc-stop").addEventListener("click", function () { stopNfc(); });
window.addEventListener("pagehide", function () { stopNfc(true); });

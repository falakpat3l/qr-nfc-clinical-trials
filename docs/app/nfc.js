/* NFC tab: read and write dosing events on NFC tags.
   Uses Web NFC, which today only exists in Chrome on Android. */
"use strict";

const NFC_SUPPORTED = typeof window.NDEFReader !== "undefined";
let nfcAbort = null;   // lets the Stop button cancel a read or write in progress

// Explains, for this particular device, why NFC is missing and what to use instead.
function nfcSupportText() {
  if (NFC_SUPPORTED) return "";
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) ||
              (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // iPadOS reports as a Mac
  if (!window.isSecureContext) {
    return "NFC only works on a secure page. Open this app over HTTPS, or on localhost.";
  }
  if (ios) {
    return "iPhone and iPad browsers do not offer Web NFC, so tags can't be read here. " +
           "Use QR labels in the Scan tab instead.";
  }
  if (/Android/.test(ua)) {
    return "This browser does not offer Web NFC. Open this page in Chrome for Android " +
           "to read and write tags. QR scanning works here.";
  }
  return "Web NFC only works in Chrome on Android phones. On this device, use QR labels " +
         "in the Scan tab instead.";
}

const supportText = nfcSupportText();
say("#nfc-support", supportText, "info");
if (!NFC_SUPPORTED) {
  $("#nfc-read").disabled = true;
  $("#nfc-write").disabled = true;
  $("#nfc-read").parentElement.hidden = true;   // three dead buttons only add noise
}

function nfcMsg(text, kind) { say("#nfc-msg", text, kind); }

// Turns a Web NFC error into a sentence that says what to do next.
function nfcError(what, e) {
  const name = e && e.name;
  if (name === "NotAllowedError") {
    return what + " failed: NFC permission was refused, or NFC is off. Turn NFC on in the " +
           "phone's settings, allow it for this page, and try again.";
  }
  if (name === "NotSupportedError") {
    return what + " failed: this phone has no NFC reader, or it is switched off.";
  }
  if (name === "NetworkError") {
    return what + " failed: the tag moved away too soon. Hold it still against the phone.";
  }
  return what + " failed: " + (e && e.message ? e.message : e);
}

// Starts a new NFC operation, cancelling any that is still running.
function nfcBegin() {
  if (nfcAbort) { try { nfcAbort.abort(); } catch (e) {} }
  nfcAbort = new AbortController();
  $("#nfc-stop").disabled = false;
  return nfcAbort;
}

// "Read tag": wait for a tag, take its first text record, decode it, log it.
$("#nfc-read").addEventListener("click", function () {
  if (!NFC_SUPPORTED) return;
  const ctrl = nfcBegin();
  nfcMsg("Hold a tag against the back of the phone…");
  try {
    const reader = new NDEFReader();
    reader.onreadingerror = function () {
      nfcMsg("Could not read that tag. Hold it still and try again.", "err");
    };
    reader.onreading = function (ev) {
      if (ctrl.signal.aborted) return;
      let text = null;
      for (const record of ev.message.records) {
        if (record.recordType === "text") {
          // Text records may be UTF-16; the record says which.
          text = new TextDecoder(record.encoding || "utf-8").decode(record.data);
          break;
        }
      }
      if (text == null) { nfcMsg("That tag holds no text record.", "err"); return; }

      let rec;
      try { rec = decodeEvent(text); }
      catch (e) { nfcMsg("Tag read, but it is not a dosing event. " + e.message + ".", "err"); return; }

      const row = addEvent(rec, "nfc");
      feedback();
      nfcMsg("Ready for the next tag.");
      $("#nfc-last").innerHTML =
        '<div class="result"><h3>Logged</h3><p>' + esc(describe(rec)) + "<br>" +
        '<span class="muted"><small>' + esc(new Date(row.ts).toLocaleTimeString()) +
        " &middot; tag " + esc(ev.serialNumber || "n/a") + "</small></span></p></div>";
    };
    reader.scan({ signal: ctrl.signal }).catch(function (e) {
      if (e && e.name === "AbortError") return;   // the user pressed Stop
      stopNfc(true);
      nfcMsg(nfcError("Scan", e), "err");
    });
  } catch (e) {
    stopNfc(true);
    nfcMsg(nfcError("Scan", e), "err");
  }
});

// "Write tag": write the event currently in the Generate form onto a tag.
$("#nfc-write").addEventListener("click", function () {
  if (!NFC_SUPPORTED) return;
  const rec = currentRecord();   // currentRecord() is in generate.js
  const problem = validateRecord(rec);
  if (problem) {
    nfcMsg("Fix the event in the Generate tab first. " + problem, "err");
    return;
  }
  // Stop any read first, or the tag being written would also be logged as a capture.
  const ctrl = nfcBegin();
  nfcMsg("Hold a writable tag against the back of the phone to write " + rec.sid + "…");
  try {
    const writer = new NDEFReader();
    writer.write({ records: [{ recordType: "text", data: encodeEvent(rec) }] }, { signal: ctrl.signal })
      .then(function () {
        if (nfcAbort === ctrl) { nfcAbort = null; $("#nfc-stop").disabled = true; }
        feedback();
        nfcMsg("Written to the tag: " + describe(rec) + ".", "ok");
      })
      .catch(function (e) {
        if (e && e.name === "AbortError") return;
        stopNfc(true);
        nfcMsg(nfcError("Write", e), "err");
      });
  } catch (e) {
    stopNfc(true);
    nfcMsg(nfcError("Write", e), "err");
  }
});

// Stops a running tag read or write. `quiet` = don't show "Stopped." (used on page close).
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

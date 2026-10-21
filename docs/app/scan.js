/* Scan tab: read QR labels with the camera and log each one.
   About 60 times a second: grab a camera frame, look for a QR code in it,
   and if it holds a dosing event, log it. */
"use strict";

const video = $("#scan-video");
const scanCanvas = $("#scan-canvas");   // hidden canvas used to read the camera's pixels
let stream = null;                      // the open camera, or null when off
let frameRequest = null;                // id of the next scheduled frame check
let scanToken = 0;                      // bumped on every stop, so a late camera answer is ignored
let lastText = "";                      // last code read, to avoid logging it twice
let lastAt = 0;                         // when it was read (ms)

function scanMsg(text, kind) { say("#scan-msg", text, kind); }

// Turns a getUserMedia error into a sentence that says what to do next.
function cameraError(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "Camera access was blocked. Allow the camera for this page in your " +
           "browser's site settings, then press Start camera again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device. You can still log events from the Generate tab.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is busy or could not start. Close other apps or tabs using it and try again.";
  }
  return "Could not open the camera" + (err && err.message ? ": " + err.message : ".");
}

function startScan() {
  if (stream || $("#scan-start").disabled) return;   // already on, or already asking
  // Check this first: on plain http the camera API is missing entirely, and
  // "no camera API" would point the user at the wrong problem.
  if (!window.isSecureContext) {
    scanMsg("The camera only works on a secure page. Open this app over HTTPS, or on localhost.", "err");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanMsg("This browser cannot open the camera. Try a current Chrome, Firefox or Safari.", "err");
    return;
  }
  const token = ++scanToken;
  $("#scan-start").disabled = true;
  scanMsg("Waiting for camera permission…");
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },   // prefer the back camera
    audio: false
  }).then(function (s) {
    if (token !== scanToken) {          // stopped (or tab changed) while the prompt was open
      s.getTracks().forEach(function (t) { t.stop(); });
      return;
    }
    stream = s;
    video.srcObject = s;
    video.hidden = false;
    $("#scan-stop").disabled = false;
    scanMsg("Looking for a code. Hold the label flat and well lit.");
    return video.play().then(function () {
      if (token === scanToken) frameRequest = requestAnimationFrame(checkFrame);
    });
  }).catch(function (err) {
    if (token !== scanToken) return;    // the user already stopped; nothing to report
    stopScan(true);
    scanMsg(cameraError(err), "err");
  });
}

// Looks at one camera frame for a QR code, then schedules the next look.
function checkFrame() {
  if (!stream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const w = video.videoWidth, h = video.videoHeight;
    if (w && h) {
      // Shrink the frame to 640 px wide first. Plenty for a label held at
      // arm's length, and it keeps scanning smooth on a mid-range phone.
      const scale = Math.min(1, 640 / w);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      if (scanCanvas.width !== cw || scanCanvas.height !== ch) {
        scanCanvas.width = cw;
        scanCanvas.height = ch;
      }
      const ctx = scanCanvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, cw, ch);
      const img = ctx.getImageData(0, 0, cw, ch);
      const hit = window.jsQR ? jsQR(img.data, cw, ch, { inversionAttempts: "dontInvert" }) : null;
      if (hit && hit.data) handleCode(hit.data);
    }
  }
  frameRequest = requestAnimationFrame(checkFrame);
}

// Called with the text inside a QR code that was just seen.
function handleCode(text) {
  const now = Date.now();
  // The same label stays in view for many frames: ignore repeats for 3 s.
  if (text === lastText && now - lastAt < 3000) return;
  lastText = text;
  lastAt = now;

  let rec;
  try {
    rec = decodeEvent(text);
  } catch (e) {
    $("#scan-last").innerHTML =
      '<div class="result"><p class="msg err">Read a code, but it is not a dosing event. ' +
      esc(e.message) + ".</p></div>";
    return;
  }
  const row = addEvent(rec, "qr");
  feedback();
  $("#scan-last").innerHTML =
    '<div class="result"><h3>Logged</h3><p>' + esc(describe(rec)) + "<br>" +
    '<span class="muted"><small>' + esc(new Date(row.ts).toLocaleTimeString()) +
    " &middot; cage " + esc(rec.cage || "n/a") + " &middot; by " + esc(rec.op || "n/a") +
    "</small></span></p></div>";
}

// Turns the camera off. `keepMsg` leaves the message line alone (used after an error).
function stopScan(keepMsg) {
  scanToken++;
  if (frameRequest) {
    cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }
  if (stream) {
    stream.getTracks().forEach(function (t) { t.stop(); });   // turns the camera light off
    stream = null;
  }
  video.srcObject = null;
  video.hidden = true;
  $("#scan-start").disabled = false;
  $("#scan-stop").disabled = true;
  if (keepMsg !== true) scanMsg("");
}

$("#scan-start").addEventListener("click", startScan);
$("#scan-stop").addEventListener("click", function () { stopScan(); });
window.addEventListener("pagehide", function () { stopScan(); });

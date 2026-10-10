/* Scan tab: read QR labels with the camera and log each one.
   About 60 times a second: grab a camera frame, look for a QR code in it,
   and if it holds a dosing event, log it. */
"use strict";

const video = $("#scan-video");
const scanCanvas = $("#scan-canvas");   // hidden canvas used to read the camera's pixels
let stream = null;                      // the open camera, or null when off
let frameRequest = null;                // id of the next scheduled frame check
let lastText = "";                      // last code read, to avoid logging it twice
let lastAt = 0;                         // when it was read (ms)

function scanMsg(text) { $("#scan-msg").textContent = text || ""; }

function startScan() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanMsg("This browser exposes no camera API.");
    return;
  }
  if (!window.isSecureContext) {
    scanMsg("The camera needs a secure context. Use HTTPS, or localhost.");
    return;
  }
  scanMsg("");
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },   // prefer the back camera
    audio: false
  }).then(function (s) {
    stream = s;
    video.srcObject = s;
    video.hidden = false;
    $("#scan-start").disabled = true;
    $("#scan-stop").disabled = false;
    return video.play();
  }).then(function () {
    frameRequest = requestAnimationFrame(checkFrame);
  }).catch(function (err) {
    scanMsg(err && err.name === "NotAllowedError"
      ? "Camera permission was refused."
      : "Could not open the camera: " + (err && err.message ? err.message : err));
    stopScan();
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
      '<p class="err">Read a code, but it is not a dosing event. ' + esc(e.message) + "</p>";
    return;
  }
  const row = addEvent(rec, "qr");
  feedback();
  $("#scan-last").innerHTML =
    "<h3>Logged</h3><p>" + esc(describe(rec)) + "<br>" +
    '<span class="muted"><small>' + esc(new Date(row.ts).toLocaleTimeString()) +
    " · cage " + esc(rec.cage || "n/a") + " · by " + esc(rec.op || "n/a") +
    "</small></span></p>";
}

function stopScan() {
  if (frameRequest) {
    cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }
  if (stream) {
    stream.getTracks().forEach(function (t) { t.stop(); });   // turns the camera light off
    stream = null;
  }
  video.hidden = true;
  $("#scan-start").disabled = false;
  $("#scan-stop").disabled = true;
}

$("#scan-start").addEventListener("click", startScan);
$("#scan-stop").addEventListener("click", stopScan);
window.addEventListener("pagehide", stopScan);

/* Capture app for trial dosing events.
   No framework, no build step, no network. Two vendored libraries only.
   Falak Ameesh Patel — PolyForm Noncommercial 1.0.0 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- payload
  // The wire format lives in codec.js so it can be tested outside the browser
  // and reviewed on its own. See that file for the specification.
  var SCHEME = CTDE.SCHEME;
  var FIELDS = CTDE.FIELDS;
  var encodeEvent = CTDE.encodeEvent;
  var decodeEvent = CTDE.decodeEvent;

  // ------------------------------------------------------------------ store
  var KEY = "ctde.events.v1";
  var events = [];

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      events = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(events)) events = [];
    } catch (e) { events = []; }   // private mode, blocked storage, bad JSON
  }

  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(events)); }
    catch (e) { /* quota or blocked — the session still works, it just won't persist */ }
  }

  function addEvent(rec, source) {
    var row = {
      ts: new Date().toISOString(),
      source: source
    };
    FIELDS.forEach(function (f) { row[f] = rec[f] || ""; });
    events.push(row);
    saveStore();
    renderLog();
    return row;
  }

  // ------------------------------------------------------------------- util
  var $ = function (sel) { return document.querySelector(sel); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function describe(rec) {
    var dose = [rec.dose, rec.unit].filter(Boolean).join(" ");
    return [rec.sid, rec.drug, dose, rec.route].filter(Boolean).join(" · ");
  }

  function feedback() {
    if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
  }

  // ------------------------------------------------------------------- tabs
  var tabs = Array.prototype.slice.call(document.querySelectorAll("nav.tabs button"));
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabs.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-current", on ? "true" : "false");
        $("#tab-" + b.dataset.tab).hidden = !on;
      });
      if (btn.dataset.tab !== "scan") stopScan();
      if (btn.dataset.tab === "benchmark") renderChart();
    });
  });

  // --------------------------------------------------------------- generate
  var genForm = $("#gen-form");

  function currentRecord() {
    var rec = {};
    FIELDS.forEach(function (f) {
      var el = genForm.elements[f];
      rec[f] = el ? el.value.trim() : "";
    });
    return rec;
  }

  var lastQR = null;

  function renderQR() {
    var rec = currentRecord();
    var payload = encodeEvent(rec);
    $("#gen-payload").textContent = payload;

    var qr = qrcode(0, "M");          // auto version, medium error correction
    qr.addData(payload);
    qr.make();

    var count = qr.getModuleCount();
    var cell = 6, margin = 4;
    var size = (count + margin * 2) * cell;

    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.style.width = Math.min(size, 280) + "px";
    canvas.style.height = Math.min(size, 280) + "px";
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
    }
    var out = $("#qr-out");
    out.innerHTML = "";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "QR code for " + describe(rec));
    out.appendChild(canvas);
    lastQR = { canvas: canvas, rec: rec, payload: payload };
  }

  genForm.addEventListener("input", renderQR);
  genForm.addEventListener("submit", function (e) { e.preventDefault(); });

  $("#gen-png").addEventListener("click", function () {
    if (!lastQR) return;
    lastQR.canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "label-" + (lastQR.rec.sid || "event").replace(/[^\w.-]+/g, "_") + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  });

  $("#gen-print").addEventListener("click", function () {
    if (!lastQR) return;
    var w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
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

  $("#gen-log").addEventListener("click", function () {
    addEvent(currentRecord(), "manual");
    feedback();
  });

  // ------------------------------------------------------------------- scan
  var video = $("#scan-video"),
      canvas = $("#scan-canvas"),
      stream = null,
      rafId = null,
      lastText = "",
      lastAt = 0;

  function scanMsg(t) { $("#scan-msg").textContent = t || ""; }

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
      video: { facingMode: { ideal: "environment" } }, audio: false
    }).then(function (s) {
      stream = s;
      video.srcObject = s;
      video.hidden = false;
      $("#scan-start").disabled = true;
      $("#scan-stop").disabled = false;
      return video.play();
    }).then(function () {
      rafId = requestAnimationFrame(tick);
    }).catch(function (err) {
      scanMsg(err && err.name === "NotAllowedError"
        ? "Camera permission was refused."
        : "Could not open the camera: " + (err && err.message ? err.message : err));
      stopScan();
    });
  }

  function tick() {
    if (!stream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      var w = video.videoWidth, h = video.videoHeight;
      if (w && h) {
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        var img = ctx.getImageData(0, 0, w, h);
        var hit = window.jsQR ? jsQR(img.data, w, h, { inversionAttempts: "dontInvert" }) : null;
        if (hit && hit.data) handleCode(hit.data);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function handleCode(text) {
    var now = Date.now();
    // Debounce: the same label stays in frame for many frames.
    if (text === lastText && now - lastAt < 3000) return;
    lastText = text; lastAt = now;

    var rec;
    try { rec = decodeEvent(text); }
    catch (e) {
      $("#scan-last").innerHTML =
        '<p class="err">Read a code, but it is not a dosing event. ' +
        esc(e.message) + "</p>";
      return;
    }
    var row = addEvent(rec, "qr");
    feedback();
    $("#scan-last").innerHTML =
      "<h3>Logged</h3><p>" + esc(describe(rec)) + "<br>" +
      '<span class="muted"><small>' + esc(new Date(row.ts).toLocaleTimeString()) +
      " · cage " + esc(rec.cage || "—") + " · by " + esc(rec.op || "—") +
      "</small></span></p>";
  }

  function stopScan() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    video.hidden = true;
    $("#scan-start").disabled = false;
    $("#scan-stop").disabled = true;
  }

  $("#scan-start").addEventListener("click", startScan);
  $("#scan-stop").addEventListener("click", stopScan);
  window.addEventListener("pagehide", stopScan);

  // -------------------------------------------------------------------- NFC
  var nfcAbort = null;
  var NFC_OK = typeof window.NDEFReader !== "undefined";

  $("#nfc-support").textContent = NFC_OK
    ? ""
    : "Web NFC is not available in this browser. Today that means it works in " +
      "Chrome on Android and nowhere else — iOS exposes no web NFC API at all. " +
      "The QR tabs work everywhere.";
  if (!NFC_OK) {
    $("#nfc-read").disabled = true;
    $("#nfc-write").disabled = true;
  }

  function nfcMsg(t) { $("#nfc-msg").textContent = t || ""; }

  $("#nfc-read").addEventListener("click", function () {
    if (!NFC_OK) return;
    nfcMsg("Hold a tag against the back of the phone…");
    try {
      var reader = new NDEFReader();
      nfcAbort = new AbortController();
      $("#nfc-stop").disabled = false;
      reader.scan({ signal: nfcAbort.signal }).then(function () {
        reader.onreadingerror = function () { nfcMsg("Could not read that tag."); };
        reader.onreading = function (ev) {
          var dec = new TextDecoder();
          var text = null;
          for (var i = 0; i < ev.message.records.length; i++) {
            var r = ev.message.records[i];
            if (r.recordType === "text") { text = dec.decode(r.data); break; }
          }
          if (text == null) { nfcMsg("Tag holds no text record."); return; }
          var rec;
          try { rec = decodeEvent(text); }
          catch (e) { nfcMsg("Tag read, but: " + e.message); return; }
          var row = addEvent(rec, "nfc");
          feedback();
          nfcMsg("");
          $("#nfc-last").innerHTML =
            "<h3>Logged</h3><p>" + esc(describe(rec)) + "<br>" +
            '<span class="muted"><small>' + esc(new Date(row.ts).toLocaleTimeString()) +
            " · tag " + esc(ev.serialNumber || "—") + "</small></span></p>";
        };
      }).catch(function (e) { nfcMsg("Scan failed: " + e.message); });
    } catch (e) { nfcMsg("Scan failed: " + e.message); }
  });

  $("#nfc-write").addEventListener("click", function () {
    if (!NFC_OK) return;
    var payload = encodeEvent(currentRecord());
    nfcMsg("Hold a writable tag against the back of the phone…");
    try {
      var writer = new NDEFReader();
      writer.write({ records: [{ recordType: "text", data: payload }] })
        .then(function () { feedback(); nfcMsg("Written to tag."); })
        .catch(function (e) { nfcMsg("Write failed: " + e.message); });
    } catch (e) { nfcMsg("Write failed: " + e.message); }
  });

  $("#nfc-stop").addEventListener("click", function () {
    if (nfcAbort) { nfcAbort.abort(); nfcAbort = null; }
    $("#nfc-stop").disabled = true;
    nfcMsg("Stopped.");
  });

  // -------------------------------------------------------------- benchmark
  var bm = { running: false, last: 0, samples: [] };

  function bmStats() {
    var s = bm.samples;
    if (!s.length) return null;
    var sum = s.reduce(function (a, b) { return a + b; }, 0);
    return {
      n: s.length,
      mean: sum / s.length,
      lo: Math.min.apply(null, s),
      hi: Math.max.apply(null, s)
    };
  }

  function bmRender() {
    var st = bmStats();
    $("#bm-n").textContent = st ? st.n : 0;
    $("#bm-mean").textContent = st ? st.mean.toFixed(1) : "—";
    renderChart();
  }

  $("#bm-start").addEventListener("click", function () {
    bm.running = true; bm.last = performance.now();
    $("#bm-start").disabled = true;
    $("#bm-mark").disabled = false;
    $("#bm-stop").disabled = false;
  });

  $("#bm-mark").addEventListener("click", function () {
    if (!bm.running) return;
    var now = performance.now();
    bm.samples.push((now - bm.last) / 1000);
    bm.last = now;
    feedback();
    bmRender();
  });

  $("#bm-stop").addEventListener("click", function () {
    bm.running = false;
    $("#bm-start").disabled = false;
    $("#bm-mark").disabled = true;
    $("#bm-stop").disabled = true;
  });

  $("#bm-reset").addEventListener("click", function () {
    bm = { running: false, last: 0, samples: [] };
    $("#bm-start").disabled = false;
    $("#bm-mark").disabled = true;
    $("#bm-stop").disabled = true;
    bmRender();
  });

  // Study ranges. Colour carries one idea: QR and NFC are two shades of the
  // same blue because they are the same kind of answer, and pen and paper is a
  // neutral grey because it is not. Your own measurement is black, so it never
  // reads as a fourth method. Every row is directly labelled as well, so nothing
  // here depends on colour alone.
  var STUDY = [
    { key: "qr",    label: "QR codes",    lo: 1, hi: 3 },
    { key: "nfc",   label: "NFC tags",    lo: 3, hi: 6 },
    { key: "paper", label: "Pen and paper", lo: 6, hi: 8 }
  ];

  function renderChart() {
    var st = bmStats();
    var rows = STUDY.map(function (r) {
      return { key: r.key, label: r.label, lo: r.lo, hi: r.hi, you: false };
    });
    if (st) {
      var m = $("#bm-method");
      var name = m.options[m.selectedIndex].text;
      rows.push({ key: "you", label: "You — " + name,
                  lo: st.lo, hi: st.hi, mean: st.mean, you: true });
    }

    var W = 640, rowH = 34, padL = 150, padR = 60, padT = 8, padB = 30;
    var H = padT + rows.length * rowH + padB;
    var max = Math.max(10, Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.hi; })) + 1));
    var x = function (v) { return padL + (v / max) * (W - padL - padR); };

    var parts = [];
    parts.push('<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" ' +
               'aria-label="Seconds per capture event by method">');

    for (var t = 0; t <= max; t++) {
      if (t % 2) continue;
      parts.push('<line class="grid" x1="' + x(t) + '" y1="' + padT +
                 '" x2="' + x(t) + '" y2="' + (H - padB) + '"/>');
      parts.push('<text class="axis" x="' + x(t) + '" y="' + (H - padB + 18) +
                 '" text-anchor="middle">' + t + "</text>");
    }
    parts.push('<text class="axis" x="' + padL + '" y="' + (H - 2) + '">seconds per event</text>');

    rows.forEach(function (r, i) {
      var cy = padT + i * rowH + rowH / 2;
      var w = Math.max(3, x(r.hi) - x(r.lo));
      var tip = r.label + ": " + r.lo.toFixed(1) + "–" + r.hi.toFixed(1) + " s" +
                (r.mean != null ? " (mean " + r.mean.toFixed(1) + " s)" : "");
      parts.push('<g class="mark' + (r.you ? " you" : "") + '">');
      parts.push("<title>" + esc(tip) + "</title>");
      parts.push('<rect class="bar ' + r.key + '" x="' + x(r.lo) +
                 '" y="' + (cy - 5) + '" width="' + w + '" height="10" rx="4"/>');
      parts.push('<text x="' + (padL - 10) + '" y="' + (cy + 5) +
                 '" text-anchor="end">' + esc(r.label) + "</text>");
      parts.push('<text x="' + (x(r.hi) + 8) + '" y="' + (cy + 5) + '">' +
                 r.lo.toFixed(r.you ? 1 : 0) + "–" + r.hi.toFixed(r.you ? 1 : 0) + "</text>");
      parts.push("</g>");
    });

    parts.push("</svg>");
    $("#bm-chart").innerHTML = parts.join("");
  }

  // -------------------------------------------------------------------- log
  function renderLog() {
    $("#log-count").textContent = events.length;
    if (!events.length) {
      $("#log-table").innerHTML = '<p class="muted">Nothing captured yet.</p>';
      return;
    }
    var rows = events.slice().reverse().slice(0, 200).map(function (e) {
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
      (events.length > 200 ? '<p class="note">Showing the 200 most recent. The export contains all ' + events.length + ".</p>" : "");
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  $("#log-csv").addEventListener("click", function () {
    var cols = ["ts", "source"].concat(FIELDS);
    var lines = [cols.join(",")].concat(events.map(function (e) {
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

  // ------------------------------------------------------------------- boot
  loadStore();
  renderQR();
  renderLog();
  renderChart();
})();

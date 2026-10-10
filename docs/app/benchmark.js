/* Benchmark tab: time yourself capturing events, and compare with the study.
   Press Start, then Mark each time you finish one capture. The seconds
   between marks are your samples. */
"use strict";

let bm = { running: false, last: 0, samples: [] };   // samples are in seconds

// Count, average, fastest and slowest of your samples (null if there are none).
function bmStats() {
  const s = bm.samples;
  if (!s.length) return null;
  const sum = s.reduce(function (a, b) { return a + b; }, 0);
  return { n: s.length, mean: sum / s.length, lo: Math.min.apply(null, s), hi: Math.max.apply(null, s) };
}

function bmRender() {
  const st = bmStats();
  $("#bm-n").textContent = st ? st.n : 0;
  $("#bm-mean").textContent = st ? st.mean.toFixed(1) : "n/a";
  renderChart();
}

// Turns the Start / Mark / Stop buttons on or off to match the state.
function bmButtons(running) {
  $("#bm-start").disabled = running;
  $("#bm-mark").disabled = !running;
  $("#bm-stop").disabled = !running;
}

$("#bm-method").addEventListener("change", renderChart);

$("#bm-start").addEventListener("click", function () {
  bm.running = true;
  bm.last = performance.now();
  bmButtons(true);
});

$("#bm-mark").addEventListener("click", function () {
  if (!bm.running) return;
  const now = performance.now();
  bm.samples.push((now - bm.last) / 1000);
  bm.last = now;
  feedback();
  bmRender();
});

$("#bm-stop").addEventListener("click", function () {
  bm.running = false;
  bmButtons(false);
});

$("#bm-reset").addEventListener("click", function () {
  bm = { running: false, last: 0, samples: [] };
  bmButtons(false);
  bmRender();
});

// The study's results, in seconds per event. Colour carries one idea: QR and
// NFC are two shades of the same blue (the same kind of answer), pen and paper
// is grey, and your own result is black so it never looks like a fourth method.
// Every row also has a text label, so nothing depends on colour alone.
const STUDY = [
  { key: "qr",    label: "QR codes",      lo: 1, hi: 3 },
  { key: "nfc",   label: "NFC tags",      lo: 3, hi: 6 },
  { key: "paper", label: "Pen and paper", lo: 6, hi: 8 }
];

// Draws the range chart as an SVG: one bar per method, plus "You" once you have samples.
function renderChart() {
  const st = bmStats();
  const rows = STUDY.map(function (r) {
    return { key: r.key, label: r.label, lo: r.lo, hi: r.hi, you: false };
  });
  if (st) {
    const m = $("#bm-method");
    const name = m.options[m.selectedIndex].text;
    rows.push({ key: "you", label: "You: " + name, lo: st.lo, hi: st.hi, mean: st.mean, you: true });
  }

  // Layout in SVG units. x(seconds) gives the horizontal position for a value.
  const W = 640, rowH = 34, padL = 150, padR = 60, padT = 8, padB = 30;
  const H = padT + rows.length * rowH + padB;
  const max = Math.max(10, Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.hi; })) + 1));
  const x = function (v) { return padL + (v / max) * (W - padL - padR); };

  const parts = [];
  parts.push('<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" ' +
             'aria-label="Seconds per capture event by method">');

  // Grid lines and numbers along the bottom, every 2 seconds.
  for (let t = 0; t <= max; t += 2) {
    parts.push('<line class="grid" x1="' + x(t) + '" y1="' + padT +
               '" x2="' + x(t) + '" y2="' + (H - padB) + '"/>');
    parts.push('<text class="axis" x="' + x(t) + '" y="' + (H - padB + 18) +
               '" text-anchor="middle">' + t + "</text>");
  }
  parts.push('<text class="axis" x="' + padL + '" y="' + (H - 2) + '">seconds per event</text>');

  // One row per method: label on the left, bar from fastest to slowest, range on the right.
  rows.forEach(function (r, i) {
    const cy = padT + i * rowH + rowH / 2;
    const w = Math.max(3, x(r.hi) - x(r.lo));
    const tip = r.label + ": " + r.lo.toFixed(1) + "–" + r.hi.toFixed(1) + " s" +
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

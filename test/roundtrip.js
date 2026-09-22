/* End-to-end check with no browser: encode a dosing event, render it as a real
 * QR matrix, rasterise that to RGBA pixels, decode it back with the same
 * scanner the app uses, and assert the record survives the trip.
 *
 * Run:  node test/roundtrip.js
 */
"use strict";

const assert = require("assert");
const path = require("path");

const CTDE = require(path.join(__dirname, "..", "docs", "codec.js"));
const qrcode = require(path.join(__dirname, "..", "docs", "vendor", "qrcode-generator.js"));
const jsQR = require(path.join(__dirname, "..", "docs", "vendor", "jsQR.js"));

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.error("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}

const SAMPLE = {
  sid: "PAPER-C1-A1", cage: "PAPER-C1", drug: "Compound A",
  dose: "10", unit: "mg/kg", route: "PO", op: "FP"
};

console.log("codec");

check("round-trips a plain record", () => {
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(SAMPLE)), SAMPLE);
});

check("survives a pipe inside a value", () => {
  const tricky = Object.assign({}, SAMPLE, { drug: "A|B (50:50)" });
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(tricky)), tricky);
});

check("survives commas, quotes and non-ASCII", () => {
  const tricky = Object.assign({}, SAMPLE, { drug: 'β-blocker, "test"', unit: "µg" });
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(tricky)), tricky);
});

check("missing fields become empty strings, not undefined", () => {
  const out = CTDE.decodeEvent(CTDE.encodeEvent({ sid: "X" }));
  assert.strictEqual(out.sid, "X");
  assert.strictEqual(out.drug, "");
});

check("rejects a foreign payload", () => {
  assert.throws(() => CTDE.decodeEvent("https://example.com/whatever"), /Not a dosing-event code/);
});

check("rejects a truncated payload", () => {
  assert.throws(() => CTDE.decodeEvent("CTDE1|a|b"), /Wrong field count/);
});

console.log("qr round trip");

// Render the QR matrix to RGBA pixels the way a camera frame would arrive.
function rasterise(text, cell = 8, quiet = 4) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = (n + quiet * 2) * cell;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const y = (r + quiet) * cell + dy;
          const x = (c + quiet) * cell + dx;
          const i = (y * size + x) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
      }
    }
  }
  return { px, size };
}

check("a generated label decodes back to the original record", () => {
  const payload = CTDE.encodeEvent(SAMPLE);
  const { px, size } = rasterise(payload);
  const hit = jsQR(px, size, size, { inversionAttempts: "dontInvert" });
  assert.ok(hit, "scanner found no code in the rendered label");
  assert.strictEqual(hit.data, payload);
  assert.deepStrictEqual(CTDE.decodeEvent(hit.data), SAMPLE);
});

check("a long record still fits and decodes", () => {
  const long = {
    sid: "SUBJ-2026-000142-COHORT-B", cage: "BLOCK-4/RACK-9/CAGE-31",
    drug: "Compound A + Compound B (co-administered)", dose: "12.5",
    unit: "mg/kg", route: "IP", op: "F.Patel"
  };
  const payload = CTDE.encodeEvent(long);
  const { px, size } = rasterise(payload);
  const hit = jsQR(px, size, size, { inversionAttempts: "dontInvert" });
  assert.ok(hit, "scanner found no code");
  assert.deepStrictEqual(CTDE.decodeEvent(hit.data), long);
});

console.log(`\n${passed} checks passed` + (process.exitCode ? ", with failures above" : ""));

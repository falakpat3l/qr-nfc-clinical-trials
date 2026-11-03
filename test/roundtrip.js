/* End-to-end check with no browser: encode a dosing event, render it as a real
 * QR matrix, rasterise that to RGBA pixels, decode it back with the same
 * scanner the app uses, and assert the record survives the trip. Also checks
 * that bad or hostile labels are turned away, and that both pages keep their
 * security policy and offline file list in step.
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

check("rejects a broken percent-encoding with a clear message", () => {
  assert.throws(() => CTDE.decodeEvent("CTDE1|A1|C1|50%|10|mg|PO|FP"), /Field "drug" is not encoded correctly/);
});

check("ignores a trailing newline from a tag or scanner", () => {
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(SAMPLE) + "\n"), SAMPLE);
});

console.log("edge cases");

const fill = (ch, n) => Array.from({ length: n }, () => ch).join("");

check("empty optional fields round-trip as empty strings", () => {
  const rec = { sid: "A1", cage: "", drug: "", dose: "", unit: "", route: "", op: "" };
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(rec)), rec);
});

check("a label with no subject ID is rejected", () => {
  assert.throws(() => CTDE.decodeEvent(CTDE.encodeEvent({ drug: "X" })), /Subject or animal ID is missing/);
  assert.throws(() => CTDE.decodeEvent("CTDE1|||||||"), /Subject or animal ID is missing/);
});

check("every field at its maximum length round-trips", () => {
  const rec = {};
  CTDE.FIELDS.forEach((f) => { rec[f] = f === "dose" ? fill("9", CTDE.MAX_LEN[f]) : fill("x", CTDE.MAX_LEN[f]); });
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(rec)), rec);
});

check("one character over the limit is rejected, for every field", () => {
  CTDE.FIELDS.forEach((f) => {
    const rec = Object.assign({}, SAMPLE);
    rec[f] = f === "dose" ? fill("9", CTDE.MAX_LEN[f] + 1) : fill("x", CTDE.MAX_LEN[f] + 1);
    assert.throws(() => CTDE.decodeEvent(CTDE.encodeEvent(rec)), /too long/, f);
    assert.match(CTDE.validateEvent(rec), /too long/, f);
  });
});

check("the longest possible label is under the payload limit", () => {
  // Gujarati letters percent-encode to 9 characters each, the worst case.
  const rec = {};
  CTDE.FIELDS.forEach((f) => { rec[f] = f === "dose" ? fill("1", CTDE.MAX_LEN[f]) : fill("ક", CTDE.MAX_LEN[f]); });
  const payload = CTDE.encodeEvent(rec);
  assert.ok(payload.length <= CTDE.MAX_PAYLOAD, payload.length + " > " + CTDE.MAX_PAYLOAD);
  assert.deepStrictEqual(CTDE.decodeEvent(payload), rec);
});

check("an oversized payload is rejected before parsing", () => {
  assert.throws(() => CTDE.decodeEvent("CTDE1|" + fill("a", CTDE.MAX_PAYLOAD)), /too long/);
});

check("unicode names survive: Gujarati, Hindi, accents, emoji", () => {
  const rec = { sid: "પ્રાણી-૧૪", cage: "पिंजरा 3", drug: "Paracétamol", dose: "2.5",
                unit: "µg", route: "PO", op: "ફલક 🧪" };
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(rec)), rec);
});

check("malformed payloads are rejected, not logged", () => {
  const bad = [
    "", "   ", null, undefined, 42, {}, "CTDE1", "ctde1|A|||||||", "CTDE2|A||||||",
    "CTDE1|A|||||||extra", "CTDE1|A|||||",
    "CTDE1|A|C|D|1e3|mg|PO|FP",          // dose in scientific notation
    "CTDE1|A|C|D|-5|mg|PO|FP",           // negative dose
    "CTDE1|A|C|D|1.2.3|mg|PO|FP",
    "CTDE1|%E0%A4|C|D|1|mg|PO|FP",       // cut-off UTF-8 sequence
    "CTDE1|%ZZ|C|D|1|mg|PO|FP"
  ];
  bad.forEach((b) => assert.throws(() => CTDE.decodeEvent(b), Error, JSON.stringify(b)));
});

check("hidden and control characters in a field are rejected", () => {
  ["%00", "%0A", "%0D", "%09", "%1B", "%7F", "%C2%85", "%E2%80%AE", "%E2%81%A6", "%E2%80%8F"].forEach((c) => {
    assert.throws(() => CTDE.decodeEvent("CTDE1|A" + c + "1|C|D|1|mg|PO|FP"), /hidden or control/, c);
  });
});

check("HTML in a field is kept as plain text, never interpreted", () => {
  const rec = Object.assign({}, SAMPLE, { drug: '<img src=x onerror="alert(1)">', op: "&amp;" });
  assert.deepStrictEqual(CTDE.decodeEvent(CTDE.encodeEvent(rec)), rec);
});

check("a field named like an object property cannot add keys", () => {
  const out = CTDE.decodeEvent("CTDE1|__proto__|constructor|D|1|mg|PO|FP");
  assert.deepStrictEqual(Object.keys(out), CTDE.FIELDS);
  assert.strictEqual(out.sid, "__proto__");
  assert.strictEqual(Object.getPrototypeOf(out), Object.prototype);
});

check("validateEvent rejects non-text values", () => {
  assert.match(CTDE.validateEvent(Object.assign({}, SAMPLE, { dose: 10 })), /must be text/);
  assert.strictEqual(CTDE.validateEvent(null), "Not a dosing event.");
  assert.strictEqual(CTDE.validateEvent(SAMPLE), "");
});

// CTDE1 has no checksum of its own: the QR code's error correction is what
// catches damage. So a changed field count or broken encoding is the only
// tampering the codec itself can see; the scan test below covers the rest.
check("a label with a field added or removed by hand is rejected", () => {
  const p = CTDE.encodeEvent(SAMPLE);
  assert.throws(() => CTDE.decodeEvent(p + "|X"), /Wrong field count/);
  assert.throws(() => CTDE.decodeEvent(p.replace(/\|[^|]*$/, "")), /Wrong field count/);
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

check("a very long unicode label still scans", () => {
  // Non-Latin text takes 9 characters per letter once encoded, so this is
  // close to the most one QR code can hold.
  const rec = { sid: fill("ક", 64), cage: fill("पि", 32), drug: fill("x", 80), dose: "12.5",
                unit: "mg/kg", route: "IP", op: fill("ફ", 32) };
  const payload = CTDE.encodeEvent(rec);
  const { px, size } = rasterise(payload, 3, 4);
  const hit = jsQR(px, size, size, { inversionAttempts: "dontInvert" });
  assert.ok(hit, "scanner found no code");
  assert.deepStrictEqual(CTDE.decodeEvent(hit.data), rec);
});

check("a damaged label is either corrected or not read, never misread", () => {
  const payload = CTDE.encodeEvent(SAMPLE);
  const { px, size } = rasterise(payload);
  // Flip a block of pixels in the middle of the code (a smudge or a tear).
  for (let y = Math.floor(size * 0.45); y < size * 0.55; y++) {
    for (let x = Math.floor(size * 0.45); x < size * 0.55; x++) {
      const i = (y * size + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
    }
  }
  const hit = jsQR(px, size, size, { inversionAttempts: "dontInvert" });
  if (hit) assert.deepStrictEqual(CTDE.decodeEvent(hit.data), SAMPLE);
});

console.log("pages");

const fs = require("fs");
const DOCS = path.join(__dirname, "..", "docs");
const read = (f) => fs.readFileSync(path.join(DOCS, f), "utf8");

check("both pages have a strict security policy and no inline code", () => {
  ["index.html", "app.html"].forEach((page) => {
    const html = read(page);
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
    assert.ok(csp, page + " has no Content-Security-Policy");
    assert.match(csp, /default-src 'self'/, page);
    assert.match(csp, /script-src 'self'(;|$)/, page);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/, page);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, page + " has an inline script");
    assert.doesNotMatch(html, /\sstyle=|<style|\son[a-z]+=/i, page + " has inline style or handler");
  });
});

check("the offline copy (sw.js) lists every file the pages load", () => {
  const sw = read("sw.js");
  const listed = new Set(Array.from(sw.matchAll(/^\s*"([^"]+)",?$/gm), (m) => m[1]));
  ["index.html", "app.html"].forEach((page) => {
    const html = read(page);
    const refs = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (m) => m[1])
      .filter((u) => !/^(https?:|data:|mailto:|#|\.\/$)/.test(u) && /\.(js|css|svg|html)$/.test(u));
    refs.forEach((u) => assert.ok(listed.has(u), page + " loads " + u + " but sw.js does not save it"));
    assert.ok(listed.has(page), "sw.js does not save " + page);
  });
  listed.forEach((f) => { if (f !== "./") assert.ok(fs.existsSync(path.join(DOCS, f)), "sw.js lists missing file " + f); });
});

check("form limits in app.html match the codec's limits", () => {
  const html = read("app.html");
  Array.from(html.matchAll(/<input name="(\w+)"[^>]*maxlength="(\d+)"/g)).forEach((m) => {
    assert.strictEqual(Number(m[2]), CTDE.MAX_LEN[m[1]], m[1]);
  });
});

console.log(`\n${passed} checks passed` + (process.exitCode ? ", with failures above" : ""));

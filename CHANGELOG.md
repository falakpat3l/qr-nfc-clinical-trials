# Changelog

## [Unreleased]

### Added
- Works offline: after one visit online, the capture app (and the write-up)
  opens and works with no signal, through a service worker (`docs/sw.js`).
  Pages are fetched fresh when there is signal, and from the saved copy when
  there is none or it is too slow (4 seconds).
- GitHub Actions runs `node test/roundtrip.js` on every push.
- Tests for empty fields, maximum lengths, Gujarati, Hindi and emoji text,
  malformed and hostile labels, a damaged QR code, the security policy and
  the offline file list (28 checks, up from 10).

### Security
- Both pages have a Content-Security-Policy: scripts, styles and data only
  from this site, no inline code.
- Scanned codes and NFC tags are treated as untrusted. Labels that are too
  long, have hidden or control characters (including text-direction tricks),
  or a dose that is not a number are rejected before they reach the log. A
  tag with an odd text encoding or far too much data is refused cleanly.
- Saved log entries are turned back into plain text on load.
- qrcode-generator updated from 1.4.4 to 2.0.4 (one drawing bug fix, same
  API). jsQR 1.4.0 is still current. Versions are noted in `docs/vendor/README.md`.

### Fixed
- The write-up's results table no longer runs 3 px off a 360 px phone screen.
- A browser that cannot open the camera at all (often a browser inside
  another app) now says so, instead of "Not supported".
- The print window builds the label without inline styles, so it still works
  under the new security policy.
- The camera box no longer shows as a black rectangle while the camera is off.
- Leaving the Scan tab while the camera permission prompt is open no longer
  leaves the camera running in the background.
- Clear messages for a blocked camera, no camera, a busy camera and a page
  opened over plain http.
- NFC: device-specific message when Web NFC is missing (iPhone, Android
  browsers other than Chrome, desktop). Stop now also cancels a write, a
  write no longer gets logged by a running read, and permission errors say
  what to do.
- The form checks the subject ID and dose before a label is printed, logged
  or written to a tag, and very long text no longer breaks the QR.
- A damaged label (a stray `%`) gives a readable error instead of "URI malformed".
- CSV export opens correctly in Excel (UTF-8 marker, Windows line endings),
  quotes line breaks, and guards against cells that Excel would run as formulas.
- The log table scrolls inside its box on a phone instead of widening the page.
- The benchmark chart keeps readable text on a phone, and long labels no
  longer get cut off.

### Changed
- "Log this event" now confirms on screen. Export buttons are off while the
  log is empty, and the empty log explains how to add records.
- The Captured button is a large target, full width on a phone.
- Tabs can be moved between with the arrow keys.

## [1.0.0] - 2026-10-07

First release of the code behind my 2023 B.Pharm thesis.

### Added
- Offline capture app (`docs/app.html`): make QR labels for dosing events,
  scan them with the camera, read and write NFC tags, time yourself against
  the study results, and export the log as CSV or JSON. Nothing leaves the
  device.
- `docs/codec.js`: the CTDE1 label format, standalone and testable.
- The write-up page, the study data with a note on what was measured and
  what was not, and the script that draws the two figures.
- `test/roundtrip.js`: makes a QR, reads it back, and checks nothing changed.
- `GUIDE.md`: a plain-English tour of the code.

### Changed
- The app's code is split into one file per tab (`docs/app/`) so each part
  is easy to find. It behaves exactly as before.
- The SVG figures are now reproducible from run to run.

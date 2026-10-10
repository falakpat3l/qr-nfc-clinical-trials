# Changelog

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

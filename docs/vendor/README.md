# Vendored third-party libraries

These files are not my work. They are vendored (committed directly rather than
installed from a CDN) so the capture app runs with no network connection, which
is the realistic condition at a trial site or in an animal house.

| File | Library | Version | Licence | Upstream |
|---|---|---|---|---|
| `jsQR.js` | jsQR | 1.4.0 (`dist/jsQR.js`) | Apache-2.0 | https://github.com/cozmo/jsQR |
| `qrcode-generator.js` | qrcode-generator | 2.0.4 (`dist/qrcode.js`) | MIT | https://github.com/kazuhikoarase/qrcode-generator |

Both files are byte-for-byte copies of the npm releases named above.

Last checked against upstream on 2026-11-02:

- jsQR 1.4.0 is still the newest release. No known security advisories.
- qrcode-generator moved from 1.4.4 to 2.0.4. The only code change in
  `qrcode.js` fixes `renderTo2dContext`, which drew the code with rows and
  columns swapped. This app draws its own canvas, so it was not affected, but
  the update is free: the API is unchanged (2.0 only added ES module builds).
  No known security advisories.

To update one: download the new release from npm, copy the file over the old
one, update this table, and run `node test/roundtrip.js`.

Their licences are separate from and unaffected by the licence covering the rest
of this repository.

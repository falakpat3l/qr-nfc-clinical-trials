# Guide: how this code works

A plain-English tour, so you can find your way around and change things safely.

## What is in here

Two separate things:

1. **The capture app** (`docs/`): a web page that makes QR labels for dosing events, scans them with the camera, reads NFC tags, and keeps a log. It works offline. GitHub Pages serves it from the `docs/` folder.
2. **The analysis** (`analysis/` and `data/`): the thesis results as CSV files, and the Python script that draws the two charts.

## Run it

App:

1. `cd docs`
2. `python3 -m http.server`
3. Open `http://localhost:8000/app.html`

Charts:

1. `pip install matplotlib`
2. `python3 analysis/make_figures.py`

## The big picture

```
form (subject, cage, drug, dose, unit, route, operator)
  -> codec.js turns it into one line of text:  CTDE1|S-014|C3|...|FP
  -> printed as a QR code (or written to an NFC tag)
  -> later: scanned with the camera
  -> codec.js turns the text back into the form fields
  -> saved to the log with the time, exportable as CSV
```

`codec.js` is the heart of it. Everything else is screens around it.

All the files in `docs/app/` share one scope, so a function written in one (like `addEvent` in `common.js`) can be used from any other. `app.html` loads them in order: `common.js` first, `main.js` last.

## Where things live

| File | What it does | Open it when you want to... |
|---|---|---|
| `docs/codec.js` | Turns a dosing event into text and back (the "CTDE1" format) | add or change a field |
| `docs/app.html` | The app's layout: the tabs and forms | change what is on screen |
| `docs/app/` | The app's behaviour, one file per tab: `generate.js`, `scan.js`, `nfc.js`, `benchmark.js`, `log.js`. `common.js` holds the saved events and helpers every tab uses; `main.js` switches tabs and starts the app | change how a tab works: open that tab's file |
| `docs/style.css` | Looks, for both pages | change colours or spacing |
| `docs/index.html` | The write-up page | edit the thesis summary |
| `docs/vendor/` | Two borrowed libraries: one draws QR codes, one reads them | never edit these |
| `data/*.csv` | The results. `data/README.md` says which are measured and which are not | |
| `analysis/make_figures.py` | Draws the two charts from the CSVs | change a chart |
| `analysis/make_placeholder_data.py` | Makes stand-in per-event data (the originals were not kept) | |
| `test/roundtrip.js` | Makes a QR, reads it back, checks nothing changed | after any change |

## Common changes

**Add a field to the label.** Add it to `FIELDS` in `codec.js`, add an input for it in `app.html`, add a column in `log.js`, and check `node test/roundtrip.js` still passes. If old printed labels must stay readable, bump the version to `CTDE2` instead of changing `CTDE1`.

**Change a chart.** Edit `analysis/make_figures.py` and run it. It saves a PNG (used by the README) and an SVG into `analysis/figures/`. Copy the SVGs into `docs/figures/` so the web page shows the new version too.

## Check you didn't break anything

```
node test/roundtrip.js
```

## Words you will see

- **CTDE1**: "Clinical Trial Dosing Event, version 1", the text format inside each label.
- **Percent-encoding**: writing awkward characters as codes (a `|` becomes `%7C`) so a value can never break the line apart.
- **Vendored**: a library copied into the repo, so the app needs no internet.
- **Web NFC**: the browser feature for reading NFC tags. Only Chrome on Android has it.

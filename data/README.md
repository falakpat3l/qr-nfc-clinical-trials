# Data

Three files. Two of them are measurements. One of them is not, and it says so on
every row.

## `user-acceptance.csv` — observed

Ten people doing pre-clinical research used all three capture methods and then
picked the one they preferred. This file holds that count.

| Column | Meaning |
|---|---|
| `method` | `paper`, `nfc` or `qr` |
| `label` | Display name |
| `respondents` | Number choosing this method, out of 10 |
| `share_percent` | The same as a percentage |

The preference question is the only one reported here. Two other questions were
asked — whether the respondent had used QR or NFC before, and whether they
thought it was faster — but the per-respondent answers were not retained, so they
are not included rather than being reconstructed.

## `capture-time-summary.csv` — observed

The range of time taken to record a single observation by each method, across
three cages per arm.

| Column | Meaning |
|---|---|
| `method` | `paper`, `nfc` or `qr` |
| `label` | Display name |
| `min_seconds` / `max_seconds` | Observed range per capture event |
| `requires_reentry` | Whether records must later be typed into a computer |

These are ranges, not means with dispersion. The underlying per-event readings
were not retained, so a mean and standard deviation cannot honestly be recovered
from them.

## `capture-events.csv` — **synthetic, not a measurement**

180 per-event rows: 3 arms, 3 cages per arm, 20 events per cage.

This file was **generated**, by `analysis/make_placeholder_data.py`, from a fixed
seed. Each row's `capture_seconds` is a uniform draw inside the observed range
for that arm. It exists so that the analysis and plotting code in this repository
can be run, tested and reviewed end to end against a realistically shaped dataset.

It is not evidence of anything. Every row carries `data_origin=placeholder` to
make that impossible to lose track of. Do not compute a statistic from it and
report the result as a finding.

Anyone repeating this study should overwrite this file with real per-event
readings and delete the generator.

| Column | Meaning |
|---|---|
| `event_id` | Sequential identifier |
| `arm` | `paper`, `nfc` or `qr` |
| `arm_label` | Display name |
| `cage_id` | Cage within the arm |
| `animal_id` | Animal within the cage |
| `event_index` | Nth event recorded in that cage |
| `capture_seconds` | Seconds to record the observation |
| `reentry_required` | Whether this record needs later typing up |
| `data_origin` | Always `placeholder` in this file |

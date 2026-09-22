"""
Generate a per-event placeholder dataset consistent with the observed summary
ranges in data/capture-time-summary.csv.

This does NOT recover the original per-event readings. Those were not retained.
What it produces is a synthetic dataset whose per-method distribution falls
inside the ranges that were actually observed, so that the analysis and plotting
code in this repository can be run, reviewed and tested end to end.

Anyone re-running the study should replace data/capture-events.csv with real
readings and delete this script.

Deterministic: fixed seed, same output every run.
"""

import csv
import random
from pathlib import Path

SEED = 20231201
CAGES_PER_ARM = 3
EVENTS_PER_CAGE = 20
ANIMALS_PER_CAGE = 5

ARMS = {
    "paper": {"label": "Traditional pen and paper", "lo": 6.0, "hi": 8.0, "reentry": True},
    "nfc":   {"label": "NFC tags",                  "lo": 3.0, "hi": 6.0, "reentry": False},
    "qr":    {"label": "QR codes",                  "lo": 1.0, "hi": 3.0, "reentry": False},
}

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "capture-events.csv"


def main() -> None:
    rng = random.Random(SEED)
    rows = []
    event_id = 0

    for arm, spec in ARMS.items():
        for cage in range(1, CAGES_PER_ARM + 1):
            cage_id = f"{arm.upper()}-C{cage}"
            for i in range(1, EVENTS_PER_CAGE + 1):
                event_id += 1
                animal = f"{cage_id}-A{rng.randint(1, ANIMALS_PER_CAGE)}"
                seconds = round(rng.uniform(spec["lo"], spec["hi"]), 2)
                rows.append({
                    "event_id": event_id,
                    "arm": arm,
                    "arm_label": spec["label"],
                    "cage_id": cage_id,
                    "animal_id": animal,
                    "event_index": i,
                    "capture_seconds": seconds,
                    "reentry_required": str(spec["reentry"]).lower(),
                    "data_origin": "placeholder",
                })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"wrote {len(rows)} placeholder events to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

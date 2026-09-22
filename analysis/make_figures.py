"""
Render the two figures used in the README and on the project page.

Design notes (deliberate, not defaults):
  * Colour carries one idea only: QR and NFC are two shades of the same blue
    because they are the same kind of answer, and pen and paper is a neutral
    grey because it is not. The reader should see two of these grouped and one
    apart before reading a single label.
  * Every category is also directly labelled on the y axis, so identity never
    depends on colour alone. The three fills separate by lightness as well as
    hue, so the grouping survives colour-vision deficiency and greyscale print.
  * Axes and grid are recessive. No frame, no chartjunk, no value on every mark.
  * Output is SVG for the web page and PNG for the README, since GitHub's
    markdown renderer is unreliable with SVG.
"""

import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "analysis" / "figures"

INK = "#000000"
MUTED = "#555555"
RECESSIVE = "#b0b0b0"
SURFACE = "#ffffff"

# QR and NFC: one hue, two shades - the same class of answer.
# Paper: neutral grey - deliberately outside that family.
ARM_COLOR = {
    "qr":    "#0000ee",
    "nfc":   "#7b7be8",
    "paper": "#6b6b6b",
}

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "Times", "DejaVu Serif"],
    "font.size": 11,
    "text.color": INK,
    "axes.labelcolor": INK,
    "axes.edgecolor": RECESSIVE,
    "xtick.color": MUTED,
    "ytick.color": INK,
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE,
})


def read_csv(name):
    with (DATA / name).open() as fh:
        return list(csv.DictReader(fh))


def strip_frame(ax, keep_bottom=True):
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_visible(keep_bottom)
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", length=3, width=0.8)


def fig_user_acceptance():
    rows = read_csv("user-acceptance.csv")
    rows.sort(key=lambda r: int(r["respondents"]))
    labels = [r["label"] for r in rows]
    counts = [int(r["respondents"]) for r in rows]
    shares = [int(r["share_percent"]) for r in rows]
    colors = [ARM_COLOR[r["method"]] for r in rows]

    fig, ax = plt.subplots(figsize=(6.6, 2.5), dpi=200)
    bars = ax.barh(labels, counts, height=0.42, color=colors, zorder=3)

    for bar, count, share in zip(bars, counts, shares):
        ax.text(count + 0.18, bar.get_y() + bar.get_height() / 2,
                f"{count}  ({share}%)", va="center", ha="left",
                fontsize=10.5, color=INK)

    ax.set_xlim(0, max(counts) + 1.8)
    ax.set_ylim(-0.7, len(labels) - 0.3)
    ax.set_xlabel("Respondents (n = 10)", fontsize=10, color=MUTED, labelpad=8)
    ax.xaxis.set_major_locator(MultipleLocator(1))
    ax.grid(axis="x", color=RECESSIVE, linewidth=0.5, alpha=0.5, zorder=0)
    ax.set_axisbelow(True)
    strip_frame(ax)
    ax.set_title("Preferred method after trying all three",
                 fontsize=12, fontweight="bold", loc="left", pad=12)

    fig.tight_layout()
    fig.savefig(OUT / "fig1-user-acceptance.svg", bbox_inches="tight")
    fig.savefig(OUT / "fig1-user-acceptance.png", bbox_inches="tight")
    plt.close(fig)


def fig_capture_time():
    rows = read_csv("capture-time-summary.csv")
    rows.sort(key=lambda r: float(r["max_seconds"]), reverse=True)
    labels = [r["label"] for r in rows]
    lo = [float(r["min_seconds"]) for r in rows]
    hi = [float(r["max_seconds"]) for r in rows]
    colors = [ARM_COLOR[r["method"]] for r in rows]

    fig, ax = plt.subplots(figsize=(6.6, 2.5), dpi=200)
    y = range(len(labels))

    for yi, a, b, c in zip(y, lo, hi, colors):
        ax.plot([a, b], [yi, yi], color=c, linewidth=2, solid_capstyle="round", zorder=3)
        ax.plot([a, b], [yi, yi], "o", color=c, markersize=7,
                markeredgecolor=SURFACE, markeredgewidth=1.5, zorder=4)
        ax.text(b + 0.35, yi, f"{a:.0f}–{b:.0f} s", va="center", ha="left",
                fontsize=10.5, color=INK)

    ax.set_yticks(list(y))
    ax.set_yticklabels(labels)
    ax.set_xlim(0, max(hi) + 2.4)
    ax.set_ylim(-0.7, len(labels) - 0.3)
    ax.set_xlabel("Seconds per capture event", fontsize=10, color=MUTED, labelpad=8)
    ax.xaxis.set_major_locator(MultipleLocator(1))
    ax.grid(axis="x", color=RECESSIVE, linewidth=0.5, alpha=0.5, zorder=0)
    ax.set_axisbelow(True)
    strip_frame(ax)
    ax.set_title("Time to record one observation",
                 fontsize=12, fontweight="bold", loc="left", pad=12)

    fig.tight_layout()
    fig.text(0.015, -0.03,
             "Pen and paper additionally requires later re-entry into a computer, "
             "which is not counted here.",
             fontsize=9, color=MUTED, ha="left", va="top")
    fig.savefig(OUT / "fig2-capture-time.svg", bbox_inches="tight")
    fig.savefig(OUT / "fig2-capture-time.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    fig_user_acceptance()
    fig_capture_time()
    print("figures written to", OUT.relative_to(ROOT))

#!/usr/bin/env python3
"""Extract the 5000-word frequency list + thematic word-family boxes from the
Davies 'A Frequency Dictionary of Spanish' PDF into data/words.json.

Usage: python3 scripts/extract.py "/path/to/dictionary.pdf"
"""
import json
import re
import sys
from pathlib import Path

import pypdf

POS = r"(?:nm/f|nm/pl|nf/pl|nmf|nm|nf|nc|adj/adv|adj|aj|adv|vr|v|prep|conj|pron|art|num|interj|n)"
HEAD_RE = re.compile(rf"^(\d+)\s+(.+?)\s+({POS})\b\s*(.*)$")
POS_NORM = {"aj": "adj", "n": "nm"}
STAT_RE = re.compile(r"^(\d+)\s*\|\s*([\d,]+)\s*(.*)$")
# thematic-box row: "caballo  780-M  horse" / "patinaje 29260-M skating" / "anaranjado 8225 orange"
BOX_ROW_RE = re.compile(
    r"^([a-zA-ZáéíóúñüÁÉÍÓÚÑÜ][a-zA-ZáéíóúñüÁÉÍÓÚÑÜ'.\- ]{0,28}?)\s+(\d{2,6})(?:-([MF]))?\s+([a-zA-Z][a-zA-Z '.\-,()]{2,60})\s*$"
)
BOX_HEAD_RE = re.compile(r"^(.+?)\s*(?:\([^)]*\))?\s*top\s*\d+\s*words", re.I)

FIRST_PAGE, LAST_PAGE = 22, 193  # 0-based PDF indices covering ranks 1..5000


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("ﬁ", "fi").replace("ﬂ", "fl")).strip()


def main() -> None:
    pdf_path = Path(sys.argv[1])
    reader = pypdf.PdfReader(str(pdf_path))
    lines: list[str] = []
    for i in range(FIRST_PAGE, LAST_PAGE):
        lines.extend(reader.pages[i].extract_text().split("\n"))

    entries: dict[int, dict] = {}
    families: list[dict] = []

    # ---- pass 1: locate thematic boxes as runs (>=6) of box-row lines ----
    skip = set()
    n = len(lines)
    i = 0
    while i < n:
        run = []
        j = i
        while j < n:
            s = lines[j].strip()
            if not s:
                j += 1
                continue
            m = BOX_ROW_RE.match(s)
            if m and not HEAD_RE.match(s):
                run.append((j, m))
                j += 1
            else:
                break
        if len(run) >= 6:
            # theme: scan forward up to 4 non-empty lines for the caption
            theme = "thematic"
            k, seen = j, 0
            while k < n and seen < 5:
                cs = lines[k].strip()
                if cs:
                    seen += 1
                    hm = BOX_HEAD_RE.search(cs)
                    if hm:
                        theme = clean(hm.group(1)).lower()
                        skip.add(k)
                        break
                k += 1
            for idx, m in run:
                skip.add(idx)
                gender = m.group(3) or ("M" if m.group(4).strip().startswith(("he ", "man")) else "")
                families.append({
                    "spanish": clean(m.group(1)),
                    "rank": int(m.group(2)),
                    "gender": m.group(3) or "",
                    "english": clean(m.group(4)),
                    "theme": theme,
                })
            i = j
        else:
            i += 1

    cur = None            # in-progress main entry
    buf: list[str] = []   # lines accumulated for cur (example etc.)

    def flush():
        nonlocal cur, buf
        if not cur:
            return
        blob = clean(" ".join(buf))
        m = re.search(r"•\s*(.+)", blob)
        cur["example_es"] = clean(m.group(1)) if m else ""
        entries[cur["rank"]] = cur
        cur, buf = None, []

    for li, raw in enumerate(lines):
        if li in skip:
            continue
        line = raw.rstrip()
        if not line.strip():
            continue

        sm = STAT_RE.match(line.strip())
        if sm and cur:
            cur["coverage"] = int(sm.group(1))
            cur["raw_freq"] = int(sm.group(2).replace(",", ""))
            markers = sm.group(3).strip()
            cur["register"] = markers if markers else ""
            flush()
            continue

        hm = HEAD_RE.match(line.strip())
        if hm:
            rank = int(hm.group(1))
            if 1 <= rank <= 5000 and rank not in entries:
                flush()
                cur = {
                    "rank": rank,
                    "spanish": clean(hm.group(2)),
                    "pos": POS_NORM.get(hm.group(3), hm.group(3)),
                    "english": clean(hm.group(4)),
                }
                buf = []
                continue

        if cur:
            buf.append(line)

    flush()

    # merge: build final word list
    words = []
    for rank in sorted(entries):
        e = entries[rank]
        words.append({
            "id": f"r{rank}",
            "spanish": e["spanish"],
            "english": e["english"],
            "pos": e["pos"],
            "example_es": e.get("example_es", ""),
            "frequency_rank": rank,
            "register": e.get("register", ""),
            "coverage": e.get("coverage"),
            "in_top_5000": True,
            "tags": [],
            "source": "seed",
        })

    seen_es = {w["spanish"].lower() for w in words}
    fam_added = 0
    for f in families:
        key = f["spanish"].lower()
        if key in seen_es:
            # attach theme tag to existing word
            for w in words:
                if w["spanish"].lower() == key and f["theme"] not in w["tags"]:
                    w["tags"].append(f["theme"])
            continue
        seen_es.add(key)
        pos = "nm" if f["gender"] == "M" else "nf"
        words.append({
            "id": f"fam{f['rank']}-{key}",
            "spanish": f["spanish"],
            "english": f["english"],
            "pos": pos,
            "example_es": "",
            "frequency_rank": f["rank"],
            "register": "",
            "coverage": None,
            "in_top_5000": f["rank"] <= 5000,
            "tags": [f["theme"]],
            "source": "seed-family",
        })
        fam_added += 1

    out = Path("data/words.json")
    out.write_text(json.dumps(words, ensure_ascii=False, indent=1))
    ranks = [w["frequency_rank"] for w in words if w["source"] == "seed"]
    print(f"main entries: {len(ranks)}  (min {min(ranks)}, max {max(ranks)})")
    missing = sorted(set(range(1, 5001)) - set(ranks))
    print(f"missing ranks: {len(missing)} -> {missing[:40]}")
    print(f"family rows parsed: {len(families)}, new words added: {fam_added}")
    print(f"total words: {len(words)} -> {out}")


if __name__ == "__main__":
    main()

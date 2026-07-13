#!/usr/bin/env python3
"""Compute the cost-saved + local-time-estimate block for a graphified site and
merge it into that site's score.json / SCORE_REPORT.md, then mark the unit done.

Run this AFTER graphify-score's tally.py has written score.json.

Usage:
    graphify-savings.py <SITE_DIR> <GRAPHIFY_OUT_DIR>
    graphify-savings.py --selftest        # offline math check, no network/fs

- Token count uses Anthropic's FREE count_tokens endpoint (no generation, no cost).
  Needs ANTHROPIC_API_KEY. If absent/unreachable it falls back to a word-based
  estimate and says so in the JSON.
- Cost = tokens x Sonnet 5 price, stored for BOTH pricing tiers (current through
  2026-08-31, and the 2026-09-01 increase). The website shows whichever is active
  on the view date.
- Local time = site_words x 0.1167 s/word, the measured qwen3:8b graphify rate
  from the local-llm-m1 benchmark (M1 Pro 16GB, 3624 words / 423s median).
- Writes graphify-out/.graphify_batch_done as the LAST action = this unit is done.
"""
import sys, os, json, datetime
from pathlib import Path

MODEL = "claude-sonnet-5"
OLLAMA_S_PER_WORD = 0.1167  # M1 Pro 16GB, qwen3:8b — local-llm-m1 benchmark (3624 words / 423s median)
DONE_MARKER = ".graphify_batch_done"
LICENSE_STEMS = ("license", "licence", "notice", "copying")


def count_tokens(text):
    """Free count_tokens API -> input_tokens for `text`. Raises on any failure."""
    import urllib.request
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("no ANTHROPIC_API_KEY")
    if not text.strip():
        return 0
    body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": text}]}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages/count_tokens",
        data=body,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["input_tokens"]


def human_time(secs):
    h, m, s = secs // 3600, (secs % 3600) // 60, secs % 60
    if h:
        return f"~{h}h {m}m"
    if m:
        return f"~{m}m {s}s"
    return f"~{s}s"


def cost(inp, out, p_in, p_out):
    return round(inp / 1e6 * p_in + out / 1e6 * p_out, 4)


def build_savings(input_tokens, output_tokens, total_words, token_note):
    return {
        "tokens": {
            "input": input_tokens,
            "output": output_tokens,
            "counted_with": "count_tokens API (free)",
            "tokenizer": MODEL,
            "note": token_note,
        },
        "would_have_cost": {
            "model": MODEL,
            "current": {
                "effective": "through 2026-08-31",
                "input_per_mtok": 2, "output_per_mtok": 10,
                "usd": cost(input_tokens, output_tokens, 2, 10),
            },
            "after_2026_09_01": {
                "effective": "from 2026-09-01",
                "input_per_mtok": 3, "output_per_mtok": 15,
                "usd": cost(input_tokens, output_tokens, 3, 15),
            },
        },
        "local_time_estimate": {
            "seconds": round(total_words * OLLAMA_S_PER_WORD),
            "human": human_time(round(total_words * OLLAMA_S_PER_WORD)),
            "site_words": total_words,
            "backend": "ollama qwen3:8b",
            "basis": "0.1167 s/word — M1 Pro 16GB, local-llm-m1 benchmark (3624 words / 423s median)",
        },
    }


def selftest():
    # pure math, no network / no fs
    s = build_savings(1_000_000, 100_000, 663_000, "test")
    assert s["would_have_cost"]["current"]["usd"] == round(1_000_000/1e6*2 + 100_000/1e6*10, 4) == 3.0, s
    assert s["would_have_cost"]["after_2026_09_01"]["usd"] == 4.5, s
    assert s["local_time_estimate"]["seconds"] == round(663_000 * 0.1167) == 77372, s
    assert human_time(77372) == "~21h 29m", human_time(77372)
    assert human_time(47) == "~47s"
    assert human_time(430) == "~7m 10s"
    assert cost(2_000_000, 0, 2, 10) == 4.0
    print("selftest OK")


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        selftest()
        return

    site, out = Path(sys.argv[1]), Path(sys.argv[2])

    # gather markdown content (skip graphify-out and license/notice files)
    total_bytes = 0
    total_words = 0
    sample_parts, sample_bytes = [], 0
    for p in site.rglob("*"):
        if p.suffix.lower() not in (".md", ".mdx"):
            continue
        if "graphify-out" in p.parts:
            continue
        if p.stem.lower() in LICENSE_STEMS:
            continue
        try:
            t = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        b = len(t.encode("utf-8"))
        total_bytes += b
        total_words += len(t.split())
        if sample_bytes < 200_000:
            sample_parts.append(t)
            sample_bytes += b
    sample_text = "\n".join(sample_parts)[:200_000]

    # input tokens: calibrate tokens/byte on the sample, scale to full content
    try:
        st = count_tokens(sample_text) if sample_text else 0
        ratio = st / max(1, len(sample_text.encode("utf-8"))) if st else 0.27
        input_tokens = round(total_bytes * ratio)
        token_note = "input scaled from a sampled count_tokens tokens/byte ratio"
    except Exception as e:  # noqa: BLE001 - never let telemetry crash the batch
        ratio = None
        input_tokens = round(total_words * 1.35)  # ~1.35 tok/word fallback
        token_note = f"ESTIMATED (count_tokens unavailable: {e}); words x 1.35"

    # output tokens: the built graph.json
    gj = out / "graph.json"
    gtext = gj.read_text(encoding="utf-8", errors="ignore") if gj.exists() else ""
    gbytes = len(gtext.encode("utf-8"))
    if not gtext:
        output_tokens = 0
    elif gbytes <= 400_000 and ratio is not None:
        try:
            output_tokens = count_tokens(gtext)
        except Exception:  # noqa: BLE001
            output_tokens = round(gbytes * (ratio or 0.27))
    else:
        output_tokens = round(gbytes * (ratio if ratio is not None else 0.27))

    savings = build_savings(input_tokens, output_tokens, total_words, token_note)

    # merge into score.json
    sj = out / "score.json"
    if sj.exists():
        d = json.loads(sj.read_text(encoding="utf-8"))
        d["savings"] = savings
        sj.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")

    # append a Savings section to SCORE_REPORT.md (uses the tier active today)
    today = os.environ.get("GFY_TODAY") or datetime.date.today().isoformat()
    tier = "current" if today < "2026-09-01" else "after_2026_09_01"
    usd = savings["would_have_cost"][tier]["usd"]
    human = savings["local_time_estimate"]["human"]
    rep = out / "SCORE_REPORT.md"
    if rep.exists():
        block = (
            "\n\n## Savings\n\n"
            f"- **Would have cost (Sonnet 5 API):** ${usd}  "
            f"({input_tokens:,} in / {output_tokens:,} out tokens)\n"
            f"- **Local run (ollama qwen3:8b) would take:** {human}  ({total_words:,} words)\n"
        )
        rep.write_text(rep.read_text(encoding="utf-8") + block, encoding="utf-8")

    # per-site final lines (printed under the driver's GraphScore line)
    print(f"    would've cost ${usd} on Sonnet 5 API · "
          f"{input_tokens + output_tokens:,} tokens ({input_tokens:,} in / {output_tokens:,} out)")
    print(f"    local run (ollama qwen3:8b) would take {human} · {total_words:,} words")

    # LAST action: mark the unit done (atomic-ish; only reached if everything above ran)
    (out / DONE_MARKER).write_text("")


if __name__ == "__main__":
    main()

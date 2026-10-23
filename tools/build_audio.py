#!/usr/bin/env python3
"""Build the app's sounds from the recordings listed in tools/sources/*.json.

For every entry: fetch the original (cached in tools/.cache), cut the chosen segment, clean it up,
match loudness, and encode an MP3 into site/audio/<scene>/. Then write
site/audio/manifest.json (pools of files per layer + credits) for the app.

  python3 tools/build_audio.py            # build everything
  python3 tools/build_audio.py storm      # only entries whose key starts with "storm"

Entry fields (see tools/sources/*.json):
  key            "<scene>/<pool>-<n>"   (pool = what the app asks for, e.g. "storm/thunder")
  kind           "bed" (continuous, made seamlessly loopable) or "shot" (a one-off event)
  source_url     direct download URL of the original recording
  file           optional local path to the original (used instead of downloading)
  start, end     segment of the original, seconds
  channels       1 or 2
  page, title, author, license, license_url   credit details shown in the app
  optional: lufs (loudness target), gain_db, hp (high-pass Hz), lp (low-pass Hz), denoise (dB),
            max_len (seconds kept; default 90 for beds, 45 for shots),
            limit_db (how much peak limiting a shot may use to reach its loudness; default 6),
            widen (seconds: make stereo from a mono recording by offsetting the right channel),
            tag (for the engine, e.g. "near"/"far" thunder), fade_in, fade_out (seconds), what (credit label),
            tame (dB: gently compress whatever sticks out of a bed by more than this, e.g. a slap of water)
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.parse

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, "tools", "sources")
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "site", "audio")
RATE = 48000
UA = "AmbianceBuild/1.0 (https://github.com/paperhurts/ambiance)"

DEFAULT_LUFS = {"bed": -24.0, "shot": -20.0}
# LAME VBR quality per kind/channels (V2 ≈ 190 kbps stereo; V4 ≈ 100 kbps mono). MP3 because every
# browser decodes it, including open-source Chromium used for testing (it has no AAC decoder).
QUALITY = {("bed", 2): "2", ("bed", 1): "3", ("shot", 2): "3", ("shot", 1): "4"}


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, **kw)
    if r.returncode:
        raise RuntimeError(f"{cmd[0]} failed: {r.stderr[-800:]}")
    return r


def fetch(entry):
    if entry.get("file") and os.path.exists(entry["file"]):
        return entry["file"]
    url = entry["source_url"]
    name = hashlib.sha1(url.encode()).hexdigest()[:12] + "_" + re.sub(r"[^A-Za-z0-9._-]+", "_", urllib.parse.unquote(url.rsplit("/", 1)[-1]))[-60:]
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        print("  downloading", url)
        run(["curl", "-sS", "-L", "-f", "-A", UA, "--max-time", "900", "-o", path + ".part", url])
        os.replace(path + ".part", path)
    return path


def decode(path, start, end, channels):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(end - start), "-i", path,
           "-ac", str(channels), "-ar", str(RATE), "-f", "f32le", "-"]
    x = np.frombuffer(run(cmd).stdout, dtype=np.float32).copy()
    return x.reshape(-1, channels)


def filt(x, channels, chain):
    """Run float audio through an ffmpeg filter chain."""
    if not chain:
        return x
    cmd = ["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", str(channels), "-i", "-",
           "-af", chain, "-f", "f32le", "-"]
    y = np.frombuffer(run(cmd, input=x.astype(np.float32).tobytes()).stdout, dtype=np.float32).copy()
    return y.reshape(-1, channels)


def loudness(x, channels):
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(RATE), "-ac", str(channels), "-i", "-",
           "-af", "ebur128=peak=true", "-f", "null", "-"]
    err = subprocess.run(cmd, input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode()
    tail = err[err.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", tail)
    p = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", tail)
    lufs = float(i.group(1)) if i and i.group(1) != "-inf" else -70.0
    peak = float(p.group(1)) if p and p.group(1) != "-inf" else -70.0
    return lufs, peak


def equal_power(n):
    t = np.linspace(0, 1, n, dtype=np.float32)
    return np.sin(t * np.pi / 2)[:, None], np.cos(t * np.pi / 2)[:, None]


def make_loop(x, xfade):
    """Crossfade the tail into the head so the file loops without a seam."""
    n = int(xfade * RATE)
    if len(x) < 4 * n:
        n = len(x) // 4
    fade_in, fade_out = equal_power(n)
    body = x[: len(x) - n].copy()
    body[:n] = x[:n] * fade_in + x[len(x) - n:] * fade_out
    return body


def widen(x_mono_long, seconds, length):
    """Stereo from mono: the right channel is the same recording `seconds` later (decorrelated)."""
    off = int(seconds * RATE)
    left = x_mono_long[:length, 0]
    right = x_mono_long[off: off + length, 0]
    return np.stack([left, right], axis=1)


def encode(x, channels, quality, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", str(channels), "-i", "-",
           "-c:a", "libmp3lame", "-q:a", quality, out]
    run(cmd, input=np.clip(x, -1, 1).astype(np.float32).tobytes())


def process(e):
    kind = e.get("kind", "shot")
    ch = int(e.get("channels", 2 if kind == "bed" else 1))
    src = fetch(e)
    start, end = float(e.get("start", 0)), float(e["end"])
    # Phones hold decoded audio uncompressed (~23 MB per stereo minute), so keep things lean:
    # the engine's random-point crossfading makes 60-90 s of a texture sound endless anyway.
    max_len = float(e.get("max_len", 90 if kind == "bed" else 45))
    extra = float(e.get("loop_xfade", 3.0)) if kind == "bed" else 0
    end = min(end, start + max_len + extra)
    if e.get("widen"):
        mono = decode(src, start, end + float(e["widen"]), 1)
        x = widen(mono, float(e["widen"]), int((end - start) * RATE))
        ch = 2
    else:
        x = decode(src, start, end, ch)

    chain = []
    hp = e.get("hp", 25 if kind == "bed" else 60)
    if hp:
        chain.append(f"highpass=f={hp}:poles=2")
    if e.get("lp"):
        chain.append(f"lowpass=f={e['lp']}:poles=2")
    if e.get("denoise"):
        chain.append(f"afftdn=nr={e['denoise']}:nf=-60:tn=1")
    x = filt(x, ch, ",".join(chain))
    if e.get("tame"):
        lufs0, _ = loudness(x, ch)
        thr = 10 ** ((lufs0 + float(e["tame"])) / 20)
        x = filt(x, ch, f"acompressor=threshold={thr:.5f}:ratio=4:attack=8:release=250:knee=4")

    if kind == "bed":
        x = make_loop(x, float(e.get("loop_xfade", 3.0)))
    else:
        fi = int(float(e.get("fade_in", 0.015)) * RATE)
        fo = int(float(e.get("fade_out", 0.25)) * RATE)
        if fi:
            x[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
        if fo:
            x[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None] ** 2

    lufs, peak = loudness(x, ch)
    target = float(e.get("lufs", DEFAULT_LUFS[kind]))
    desired = target - lufs + float(e.get("gain_db", 0))
    headroom = -1.0 - peak  # never past -1 dBFS
    # Sharp sounds (a crunch, a crack) would end up far too quiet if their single loudest instant
    # set the level; let a gentle limiter shave up to a few dB off those peaks instead.
    extra = min(max(desired - headroom, 0.0), float(e.get("limit_db", 6 if kind == "shot" else 0)))
    gain = min(desired, headroom + extra)
    x = x * (10 ** (gain / 20))
    if extra > 0.1:
        x = filt(x, ch, "alimiter=limit=0.891:attack=2:release=60:level=0")

    pool = e["key"].rsplit("-", 1)[0]
    scene, name = e["key"].split("/", 1)
    digest = hashlib.sha1(x[:: max(1, len(x) // 50000)].tobytes()).hexdigest()[:8]
    rel = f"audio/{scene}/{name}.{digest}.mp3"
    out = os.path.join(ROOT, "site", rel)
    for old in os.listdir(os.path.dirname(out)) if os.path.isdir(os.path.dirname(out)) else []:
        if old.startswith(name + ".") and old != os.path.basename(out):
            os.remove(os.path.join(os.path.dirname(out), old))
    if not os.path.exists(out):
        encode(x, ch, QUALITY[(kind, ch)], out)
    dur = len(x) / RATE
    print(f"  {e['key']:<28} {dur:7.1f}s  {lufs:6.1f} → {lufs + gain:6.1f} LUFS  {os.path.getsize(out) // 1024:>5} KB")
    item = {"file": rel, "dur": round(dur, 2)}
    if e.get("tag"):
        item["tag"] = e["tag"]
    if e.get("weight"):
        item["weight"] = e["weight"]
    return pool, item


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    entries = []
    for f in sorted(os.listdir(SOURCES)):
        if f.endswith(".json"):
            entries += json.load(open(os.path.join(SOURCES, f)))
    manifest_path = os.path.join(OUT, "manifest.json")
    old = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {"pools": {}}
    pools = {} if not only else {k: v for k, v in old.get("pools", {}).items() if not k.startswith(only)}
    for e in entries:
        if only and not e["key"].startswith(only):
            continue
        try:
            pool, item = process(e)
        except Exception as ex:  # keep going; a missing sound just drops out of the app
            print(f"  !! {e['key']}: {ex}")
            continue
        pools.setdefault(pool, []).append(item)

    credits, seen = [], set()
    for e in entries:
        page = e.get("page") or e.get("source_url")
        if page in seen:
            continue
        seen.add(page)
        credits.append({
            "what": e.get("what") or e["key"].split("/")[1].rsplit("-", 1)[0].replace("-", " ").capitalize(),
            "title": e.get("title", ""), "author": e.get("author", ""), "page": page,
            "license": e.get("license", ""), "license_url": e.get("license_url", ""),
        })
    files = sorted({i["file"] for v in pools.values() for i in v} | {"audio/silence.mp3"})
    manifest = {"pools": dict(sorted(pools.items())), "files": files, "credits": credits}
    json.dump(manifest, open(manifest_path, "w"), indent=1)
    # remove encoded files nothing refers to any more
    for dirpath, _, names in os.walk(OUT):
        for n in names:
            rel = os.path.relpath(os.path.join(dirpath, n), os.path.join(ROOT, "site"))
            if n.endswith((".m4a", ".mp3")) and n != "silence.mp3" and rel not in files:
                os.remove(os.path.join(dirpath, n))
    total = sum(os.path.getsize(os.path.join(ROOT, "site", f)) for f in files if os.path.exists(os.path.join(ROOT, "site", f)))
    print(f"\n{len(files)} files, {total / 1e6:.1f} MB → site/audio/manifest.json")


if __name__ == "__main__":
    main()

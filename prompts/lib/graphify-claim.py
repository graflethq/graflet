#!/usr/bin/env python3
"""Atomic per-unit claims for collision-free PARALLEL graphify sessions on ONE machine.

Many CommandCode.ai / Hermes sessions can run the batch driver at once against the
same drive without ever touching the same unit. The lock is a directory created with
mkdir (atomic on a local filesystem) under <ROOT>/.graphify-claims/. Popularity order
is preserved: `next` returns the most-popular unit that is neither done nor claimed.

Commands:
  next    <ROOT> <MAP> <SESSION> [STALE]  -> print the most-popular unclaimed+undone
                                             unit, now claimed by SESSION (empty if none)
  refresh <ROOT> <PATH> <SESSION>         -> bump my claim's heartbeat (call each minute)
  release <ROOT> <PATH> <SESSION>         -> drop my claim (call once a unit is done)
  release-all <ROOT> <SESSION>            -> drop all my claims (call on stop / interrupt)
  --selftest                              -> offline concurrency check

STALE default 900s (15 min): a claim older than that = owner presumed dead, so any
session may steal it. Live sessions refresh well within that window.
"""
import sys, os, json, time, shutil
from pathlib import Path

DEFAULT_STALE = 900
DONE_REL = "graphify-out/.graphify_batch_done"


def claims_root(root):
    d = Path(root) / ".graphify-claims"
    d.mkdir(exist_ok=True)
    return d


def enc(path):
    # GitHub owner/repo/version names never contain '~'; safe reversible flatten.
    return path.replace("/", "~")


def _read_owner(cdir):
    try:
        return json.loads((cdir / "owner").read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def _write_owner(cdir, session):
    (cdir / "owner").write_text(json.dumps({"session": session, "ts": time.time()}), encoding="utf-8")


def is_done(root, path):
    return (Path(root) / path / "graphify-out" / ".graphify_batch_done").exists()


def try_claim(root, path, session, stale):
    """Atomically claim `path` for `session`. Returns True if owned after the call."""
    cdir = claims_root(root) / enc(path)
    try:
        cdir.mkdir()                         # atomic test-and-set
        _write_owner(cdir, session)
        return True
    except FileExistsError:
        owner = _read_owner(cdir)
        if owner.get("session") == session:  # already mine (re-entrant)
            _write_owner(cdir, session)
            return True
        # Age = owner heartbeat if present, else the dir's own mtime. The mtime
        # fallback closes the mkdir-before-owner-write window: a claim just created
        # by another process has a recent mtime and is NOT stealable, so racers see
        # it as busy instead of stealing a claim mid-birth. A process that crashed
        # in that window leaves a stale mtime and becomes stealable later.
        ts = owner.get("ts")
        if ts is None:
            try:
                ts = cdir.stat().st_mtime
            except OSError:
                return False
        if time.time() - ts > stale:         # stale -> steal
            try:
                shutil.rmtree(cdir)
                cdir.mkdir()
                _write_owner(cdir, session)
                return True
            except (FileExistsError, OSError):
                return False                 # lost the steal race
        return False                         # busy, held by a live session


def cmd_next(root, mapfile, session, stale):
    for line in Path(mapfile).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            path = json.loads(line)["path"]
        except Exception:  # noqa: BLE001
            continue
        if is_done(root, path):
            continue
        if try_claim(root, path, session, stale):
            print(path)
            return
    # nothing claimable: all done or everything in flight
    print("")


def cmd_refresh(root, path, session):
    cdir = claims_root(root) / enc(path)
    if cdir.exists() and _read_owner(cdir).get("session") == session:
        _write_owner(cdir, session)


def cmd_release(root, path, session):
    cdir = claims_root(root) / enc(path)
    if cdir.exists() and _read_owner(cdir).get("session") == session:
        shutil.rmtree(cdir, ignore_errors=True)


def cmd_release_all(root, session):
    base = claims_root(root)
    n = 0
    for cdir in base.iterdir():
        if cdir.is_dir() and _read_owner(cdir).get("session") == session:
            shutil.rmtree(cdir, ignore_errors=True)
            n += 1
    print(f"released {n} claim(s)")


def selftest():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        mp = root / "map.jsonl"
        mp.write_text('{"path":"a/b/default","files":1}\n{"path":"c/d/default","files":1}\n', encoding="utf-8")
        # session S1 claims the first (most popular) unit
        assert try_claim(root, "a/b/default", "S1", DEFAULT_STALE) is True
        # session S2 cannot steal a fresh claim -> must skip to the next unit
        assert try_claim(root, "a/b/default", "S2", DEFAULT_STALE) is False
        assert try_claim(root, "c/d/default", "S2", DEFAULT_STALE) is True
        # re-entrant: S1 re-claiming its own is fine
        assert try_claim(root, "a/b/default", "S1", DEFAULT_STALE) is True
        # stale steal: force S1's claim old, S2 takes it
        _write_owner(claims_root(root) / enc("a/b/default"), "S1")
        (claims_root(root) / enc("a/b/default") / "owner").write_text(
            json.dumps({"session": "S1", "ts": time.time() - 10_000}), encoding="utf-8")
        assert try_claim(root, "a/b/default", "S2", DEFAULT_STALE) is True
        # done units are skipped by next
        (root / "a/b/default/graphify-out").mkdir(parents=True)
        (root / "a/b/default/graphify-out/.graphify_batch_done").write_text("")
        cmd_release(root, "a/b/default", "S2")   # S2 releases what it held
        cmd_release(root, "c/d/default", "S2")
        # next as a fresh session: a/b is done, c/d free -> claims c/d
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            cmd_next(root, str(mp), "S3", DEFAULT_STALE)
        assert buf.getvalue().strip() == "c/d/default", buf.getvalue()
    print("selftest OK")


def main():
    a = sys.argv[1:]
    if a == ["--selftest"]:
        selftest(); return
    cmd = a[0]
    if cmd == "next":
        root, mapfile, session = a[1], a[2], a[3]
        stale = int(a[4]) if len(a) > 4 else DEFAULT_STALE
        cmd_next(root, mapfile, session, stale)
    elif cmd == "refresh":
        cmd_refresh(a[1], a[2], a[3])
    elif cmd == "release":
        cmd_release(a[1], a[2], a[3])
    elif cmd == "release-all":
        cmd_release_all(a[1], a[2])
    else:
        sys.exit(f"unknown command: {cmd}")


if __name__ == "__main__":
    main()

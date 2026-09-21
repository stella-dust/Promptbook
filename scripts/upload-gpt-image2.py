"""Resumable upload of prepared public gallery objects to the existing R2 bucket.

Usage: python3 scripts/upload-gpt-image2.py /tmp/gallery-derived/upload-manifest.json
Relies on the current Wrangler OAuth login; does not read or create secrets.
"""

import concurrent.futures
import hashlib
import json
import subprocess
import sys
import threading
import time
from pathlib import Path

manifest_file = Path(sys.argv[1])
objects = json.loads(manifest_file.read_text())
done_file = manifest_file.with_name("uploaded-keys.txt")
done = set(done_file.read_text().splitlines()) if done_file.exists() else set()
lock = threading.Lock()
wrangler = Path("node_modules/.bin/wrangler").resolve()


def upload(obj):
    key = obj["key"]
    if not key.startswith("published/gpt-image2-") or ".." in key or "\n" in key:
        raise ValueError("Unexpected R2 key")
    local = Path(obj["path"])
    hash_state = hashlib.sha256()
    with local.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hash_state.update(chunk)
    digest = hash_state.hexdigest()
    if digest != obj["sha256"] or local.stat().st_size != obj["bytes"]:
        raise ValueError(f"Local file changed: {key}")
    if key in done:
        return
    command = [str(wrangler), "r2", "object", "put", "promptbook-media/" + key,
               "--file", str(local), "--content-type", obj["mimeType"],
               "--cache-control", "public, max-age=31536000, immutable", "--remote"]
    for attempt in range(4):
        result = subprocess.run(command, capture_output=True, text=True, timeout=240)
        if result.returncode == 0:
            with lock:
                with done_file.open("a") as output:
                    output.write(key + "\n")
                done.add(key)
                if len(done) % 25 == 0 or len(done) == len(objects):
                    print(f"Uploaded {len(done)}/{len(objects)}", flush=True)
            return
        if attempt < 3:
            time.sleep(2 ** attempt)
        else:
            raise RuntimeError(f"R2 upload failed: {key}: {result.stderr[-1000:]}")


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    futures = [pool.submit(upload, obj) for obj in objects]
    for future in concurrent.futures.as_completed(futures):
        future.result()
print(f"Confirmed {len(done)} of {len(objects)} objects")

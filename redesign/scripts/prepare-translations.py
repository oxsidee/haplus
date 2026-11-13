import argparse
import glob
import json
import os
import shutil
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = "/usr/local/lib/python3.14/site-packages/hass_frontend/static/translations"


def deep_merge(base, extra):
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value


def nest(flat):
    out = {}
    for key, value in flat.items():
        parts = key.split(".")
        cur = out
        for part in parts[:-1]:
            cur = cur.setdefault(part, {})
        cur[parts[-1]] = value
    return out


def extract(image):
    tmp = tempfile.mkdtemp()
    cid = subprocess.check_output(["docker", "create", image], text=True).strip()
    try:
        subprocess.check_call(["docker", "cp", f"{cid}:{SRC}", tmp], stdout=subprocess.DEVNULL)
    finally:
        subprocess.call(["docker", "rm", cid], stdout=subprocess.DEVNULL)
    return tmp, os.path.join(tmp, "translations")


parser = argparse.ArgumentParser()
parser.add_argument("--from", dest="source")
parser.add_argument("--image", default="ghcr.io/home-assistant/home-assistant:2026.11.1")
parser.add_argument("--langs", default="ru")
args = parser.parse_args()

tmp = None
source = args.source
if not source:
    tmp, source = extract(args.image)

target = os.path.join(ROOT, "translations", "frontend")
os.makedirs(target, exist_ok=True)
for lang in args.langs.split(","):
    flat = {}
    for path in glob.glob(os.path.join(source, f"{lang}-*.json")) + glob.glob(
        os.path.join(source, "*", f"{lang}-*.json")
    ):
        with open(path, encoding="utf-8") as f:
            flat.update(json.load(f))
    data = nest(flat)
    override = os.path.join(ROOT, "redesign", "translations", f"{lang}.json")
    if os.path.exists(override):
        with open(override, encoding="utf-8") as f:
            deep_merge(data, json.load(f))
    with open(os.path.join(target, f"{lang}.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(lang, len(flat))
if tmp:
    shutil.rmtree(tmp)

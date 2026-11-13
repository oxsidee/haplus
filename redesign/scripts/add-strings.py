import json
import sys

ROOT = __file__.rsplit("/redesign/scripts/", 1)[0]


def set_path(d, path, value):
    parts = path.split(".")
    for p in parts[:-1]:
        d = d.setdefault(p, {})
    d[parts[-1]] = value


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    en_path = f"{ROOT}/src/translations/en.json"
    ru_path = f"{ROOT}/redesign/translations/ru.json"
    en = json.load(open(en_path, encoding="utf-8"))
    ru = json.load(open(ru_path, encoding="utf-8"))
    for key, (en_value, ru_value) in spec.items():
        set_path(en, key, en_value)
        set_path(ru, key, ru_value)
    text = json.dumps(en, ensure_ascii=False, indent=2).replace(" ", "\\u00a0")
    open(en_path, "w", encoding="utf-8").write(text + "\n")
    json.dump(ru, open(ru_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


main()

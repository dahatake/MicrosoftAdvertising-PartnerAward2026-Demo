"""Japanese -> English translation of server-produced text and demo data.

Source strings are Japanese. A dictionary maps exact strings, and templates with positional
placeholders ({1}, {2}, ...) map generated sentences. Used by the API (when the client sends
`X-Lang: en`) and served to the browser so both sides translate identically.
"""
import glob
import json
import os
import re

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "i18n")
CJK = re.compile(r"[\u3000-\u9fff\uff00-\uffef]")
PLACEHOLDER = re.compile(r"\{(\d+)\}")

_exact = {}
_templates = []


def load():
    _exact.clear()
    _templates.clear()
    merged = {}
    for path in sorted(glob.glob(os.path.join(DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            merged.update(json.load(f))
    for ja, en in merged.items():
        if PLACEHOLDER.search(ja):
            parts = PLACEHOLDER.split(ja)
            literal = parts[0::2]
            rx = "^" + "(.+?)".join(re.escape(p) for p in literal) + "$"
            _templates.append((len("".join(literal)), re.compile(rx, re.S), en))
        else:
            _exact[ja] = en
    _templates.sort(key=lambda t: -t[0])
    return merged


MERGED = load()


def tr(s):
    if not isinstance(s, str) or not CJK.search(s):
        return s
    core = s.strip()
    lead, trail = s[: len(s) - len(s.lstrip())], s[len(s.rstrip()):]
    out = _translate(core)
    return s if out is None else lead + out + trail


def _translate(core):
    if core in _exact:
        return _exact[core]
    for _, rx, en in _templates:
        m = rx.match(core)
        if m:
            groups = [tr(g) for g in m.groups()]
            return PLACEHOLDER.sub(lambda k: groups[int(k.group(1)) - 1], en)
    for sep in (" / ", "、"):
        if sep in core:
            parts = core.split(sep)
            done = [_translate(p.strip()) if CJK.search(p) else p for p in parts]
            if all(d is not None for d in done):
                return (" / " if sep == " / " else ", ").join(done)
    return None


def localize(obj, lang):
    if lang != "en":
        return obj
    if isinstance(obj, str):
        return tr(obj)
    if isinstance(obj, list):
        return [localize(x, lang) for x in obj]
    if isinstance(obj, dict):
        return {k: localize(v, lang) for k, v in obj.items()}
    return obj

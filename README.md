# What's Your Type?! (v3)
MBTI for designers. 2 players, live, inside MS Paint.

Start here:
1. `BRIEF.md`: the concept + full spec
2. `CLAUDE.md`: rules Claude Code follows in this repo
3. `PROMPTS.md`: the build, step by step

## Setup
```bash
git init && git add . && git commit -m "brief"
gh repo create whats-your-type-v3 --public --source=. --push
claude
```

## Run it locally
```bash
python3 serve.py
```
Open http://localhost:8000. On your phone (same wifi) use your laptop's IP, e.g. `http://192.168.1.20:8000` (find it with `ipconfig getifaddr en0`).
`serve.py` turns off browser caching, so a reload always shows your latest changes.
Dev shortcut: add `#draw`, `#challenge3`, `#card` etc. to the URL to jump to a screen.

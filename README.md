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

## AI write-ups (OpenAI, via Vercel)
The game asks AI for two short things: a personality **reading** under your Type Card,
and a line on **how two players would work together** on the compare screen.

The API key is **never in this repo or in the browser**. It lives on Vercel as a secret
setting, and only `api/ai.js` (a tiny server function) can use it. That function only
accepts checked game data (name, 5 trait numbers, font names from our list) and builds
the prompt itself, so nobody can use it as a free general AI.

If the AI can't be reached (offline, no key, running on `serve.py`), the game writes its
own reading from your traits and carries on. Nothing waits on AI.

### Deploy on Vercel
1. Go to vercel.com → **Add New… → Project** → import `whats-your-type-v3` from GitHub.
2. Framework preset: **Other**. Leave build command and output directory empty.
3. **Environment Variables**: add `OPENAI_API_KEY` = your key (make a fresh one).
   Optional: `OPENAI_MODEL` (default `gpt-4o-mini`).
4. **Deploy.** Every `git push` redeploys automatically.
5. In the OpenAI dashboard, set a small monthly **usage limit** on the key.

To test the AI on your laptop, install the Vercel CLI and run `vercel dev`
(it reads the same environment variables). `python3 serve.py` works too, just without AI.

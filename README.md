# What's Your Type?! (v3)
MBTI for designers. 2 players, live, inside MS Paint.

**Play it:** https://whats-your-type-v3-anvii.vercel.app

Start here:
1. `BRIEF.md`: the concept + full spec
2. `CLAUDE.md`: rules Claude Code follows in this repo
3. `PROMPTS.md`: the build, step by step

## File structure
```
index.html              the page: loads libraries, then js/ in order
style.css               all styling
serve.py                local server, with the room and wall relays in memory
js/
  icons.js              original pixel icons
  type.js               ransom-note headings, palettes, stickers
  wallpaper.js          desktop wallpaper
  fx.js                 pixel cursors, confetti, screensaver and other effects
  sound.js              Web Audio synth (no audio files)
  types.js              5 traits, questions, 18 fonts, scoring
  net.js                share codes and live rooms
  draw.js               self-portrait drawing tool (p5.js)
  camera-portrait.js    webcam to pixel-art portrait (p5.js)
  voice-check.js        Challenge 1, the "say hello" vibe check (p5.js + p5.sound)
  challenges.js         challenges 2 to 5 and the quick questions
  ai.js                 browser side of the AI write-ups
  palette.js            colour palette pick
  card.js               the Type Card (p5.js)
  compat.js             compare two players
  main.js               screen state machine, desktop, taskbar, boot
api/                    Vercel serverless functions
  ai.js                 builds the prompts, calls OpenAI (the key lives here)
  room.js               live room relay (Upstash Redis)
  gallery.js            the Card Wall
  turn.js               optional TURN logins for direct connections
```

Libraries, all from a CDN: p5.js 1.11.1, p5.sound 1.11.1 (loaded only on the
vibe check), 98.css, PeerJS, qrcode-generator. No build step.

**Where p5.js is used:** the drawing canvas, the camera portrait, the voice poster and
meter, and the Type Card image. The other screens are HTML and CSS.

## Screens (the state machine)
`js/main.js` holds the order. `W.go(name)` exits one screen and enters the next.

| State | Goes to | When |
|---|---|---|
| `boot` | `lobby` | tap to start |
| `lobby` | `draw` | Play solo, or the host's Start |
| `lobby` | `compat` | Compare a code, or a friend's link |
| `draw` | `hello` | Done, or Next after time runs out |
| `hello` (Challenge 1) | `challenge2` | Next, after the voice and 2 quick questions |
| `challenge2` to `challenge5` | the next one | Next, after the 2 quick questions |
| `challenge5` | `palette` | Next |
| `palette` | `card` | Next |
| `card` | `compat` | Compare |
| `compat` | `lobby` | Lobby, Play again, or Rematch in a room |
| `compat` | `draw` | Rematch in solo |

In a room the host moves both players through `draw`, `hello`, `challenge2` to `challenge5`,
`palette` and `card` (`ROUNDS` in `js/net.js`), once both have finished the round.
The Start menu can jump to `lobby` or `boot` from any screen.

Two screens have their own inner states, listed at the top of each file:
- **Camera** (`camera-portrait.js`): requesting, preview, countdown, captured, error, done.
- **Voice** (`voice-check.js`): loading, ready, starting, room, listening, confirm, tap, asking, done.

## How answers become a result
All of this runs in the browser and has no randomness, so the same answers always give the same result.

1. Each trait is `0.5 × challenge + 0.25 × question 1 + 0.25 × question 2`.
2. **Energy** has no slider challenge. The voice is its challenge half: introvert is 0, ambivert is 0.5,
   extrovert is 1. Skipping the voice lets the two questions decide on their own.
3. The palette pick adds a small nudge to the traits.
4. `W.resultFor(traits)` ranks the 18 fonts by distance from the traits. The closest one is your type.

The AI only writes words about a result that is already decided. Two parts do vary between
plays: the quick questions (AI or a shuffled pool) and the wording of the reading.

## Mind The Gap, in short
The spacing on a sign looks off: fix it or ship it. Challenge 4 scores how you work:
`0.6 × time + 0.2 × number of adjustments + 0.2 × evenness`.
Time runs from the start to your last adjustment, between 5 and 20 seconds, so waiting doesn't count.
The code measures this. The result (eyeballed, balanced or obsessed) is then one word the AI gets.

## The voice check, in short
Thresholds are named constants at the top of `js/voice-check.js`.

| | Flat pitch | Expressive pitch |
|---|---|---|
| **Quiet** | introvert | ambivert |
| **Loud** | ambivert | extrovert |

It measures how much the pitch *moves*, not how high it is, because how high a voice sits is
mostly anatomy. Only the final word is stored. It's a playful guess, not science.

## Privacy
- **Photo:** processed in the browser only. The camera stops the moment the snap is taken.
  It is never sent to the AI or stored on a server.
- **Rooms:** the other player receives only the 24×24 grid of colour numbers.
- **Card Wall:** pinning is your choice. A pinned card stores only the 24×24 grid of colours, never the photo.
- **Voice:** audio is never recorded or sent. Only introvert, ambivert or extrovert leaves `voice-check.js`.

## How data flows
```
User           draws or snaps, says hello, plays challenges, answers questions
  ↓
p5 frontend    js/ turns each answer into numbers, then W.resultFor(traits) picks the type
  ↓            POST /api/ai with checked data only: name, 5 numbers, type, font names,
  ↓            palette, voice word, gap style. Never the photo or the audio.
API route      api/ai.js checks each value against an allowlist and builds the prompt
  ↓
LLM            OpenAI (gpt-4o-mini by default) writes 2 short sentences
  ↓
Result         the reading is typed out under the Type Card
               (no answer in 10 seconds? js/ai.js writes its own from the traits)
```
Room moves take a separate path: browser to `api/room.js` (or PeerJS) to the other browser.

## The LLM prompts (verbatim from `api/ai.js`)
**System prompt, used for every request:**
```
You are the voice of a retro Windows 95 style typography personality quiz at a design school showcase. Be warm, witty and specific to the data. Plain text only: no emojis, no em dashes, no lists, no quotes around the answer. Talk to the player as "you". Never mention AI, models or prompts.
```

`${...}` is filled in by the server after checking the value.
`describe(traits)` gives text like `Introvert 90% / Extrovert 10%; Free spirit 80% / Planner 20%; ...`.

**Reading** (under the Type Card):
```
Player: ${name}. Personality traits: ${describe(traits)}. Their design type: ${type}. Their fonts: headline ${fonts[0]}, subheader ${fonts[1]}, body text ${fonts[2]}. The font that pairs best with them: ${pair}. Their chosen colour palette: ${palette}. ${voice}${gaps}In 2 short sentences (max 45 words), Gen Z tone but kind: describe their designer personality (how they work and show up), then one playful tip for using their fonts.
```
`${voice}` is `Their "say hello" vibe check sounded ${body.voice}. `, or empty if it was skipped.
`${gaps}` is `Told the gaps on a sign looked off, they ${phrase}. `, where the phrase is `eyeballed it and shipped it`,
`tidied the gaps at a steady pace` or `obsessed over every single gap`.

**Compatibility** (compare screen):
```
Two designers. ${a.name} is ${a.type} (${describe(a.traits)}). ${b.name} is ${b.type} (${describe(b.traits)}). Their match score is ${score}%. In 1 or 2 short sentences (max 35 words), say playfully how they would work together on a poster: who does what, and where they might clash.
```

**Questions** (the quick this-or-that questions):
```
Write 10 quick this-or-that questions for a designer personality quiz played by design students at a showcase. Gen Z tone, funny, about studio life, crits, Figma, moodboards, deadlines, group projects. 2 new questions for each of these 5 scales: scale 1 = Introvert vs Extrovert; scale 2 = Free spirit vs Planner; scale 3 = Futurist vs Nostalgic; scale 4 = Big picture vs Detail-obsessed; scale 5 = Slow burner vs Fast mover. Each question has two answers, each written under the name of the personality it fits: the answer under "Futurist" must sound like a futurist, the one under "Nostalgic" like a nostalgic person, and so on. Question: max 34 characters. Each answer: max 30 characters. No placeholders. Reply with JSON only: {"questions": [ 10 objects, 2 per scale, shaped like: {"scale": 1, "question": string, "Introvert": string, "Extrovert": string} / {"scale": 2, "question": string, "Free spirit": string, "Planner": string} / {"scale": 3, "question": string, "Futurist": string, "Nostalgic": string} / {"scale": 4, "question": string, "Big picture": string, "Detail-obsessed": string} / {"scale": 5, "question": string, "Slow burner": string, "Fast mover": string} ] }
```

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
Dev shortcut: add `#draw`, `#hello`, `#challenge3`, `#card` etc. to the URL to jump to a screen.
The camera and mic only work on `localhost` or HTTPS, so test those on a phone through a Vercel link.

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

## Live rooms on campus wifi (Vercel storage)
Campus wifi (NUS included) blocks phones from connecting to each other directly.
So on Vercel, rooms send their messages through our own site instead (`api/room.js`),
using a small free Redis database. Phones can always reach the website, so this works
on any wifi. Without the database, rooms fall back to direct PeerJS connections.

Set it up once:
1. Vercel project → **Storage** tab → **Create Database** → pick **Upstash** (Redis)
   → free plan → create, and **connect it to this project**.
   Vercel adds the settings it needs (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) by itself.
2. **Deployments** → ⋯ on the latest → **Redeploy**.

On your laptop, `python3 serve.py` runs the same relay in memory, so rooms work locally too.
(Optional, for the direct-connection fallback only: `api/turn.js` can hand out TURN relay
logins from Vercel settings, see the comment at the top of that file.)

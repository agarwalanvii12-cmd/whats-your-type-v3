# WHAT'S YOUR TYPE?! (v3) · Brief

> MBTI, but for designers. Two players, live, inside MS Paint.
> ID2116 Computing for Design · Project 02 · showcase build

---

## 1. The one-liner
Two designers join the same room on their phones. They draw themselves in 15 seconds, play 5 timed design challenges side by side, and each gets a **4-letter Type Code**, a **font**, and a **Type Card**. Then the game tells them how well their fonts pair.

---

## 2. The Type Code (like MBTI)
Four axes, two letters each, giving **16 types**.

| # | Axis | Letters | Measured by |
|---|---|---|---|
| 1 | Volume | **B**old / **L**ight | Challenge 1 |
| 2 | Structure | **G**rid / **F**reeform | Challenge 2 |
| 3 | Era | **R**etro / **N**ew | Challenge 3 |
| 4 | Precision | **K**erner / **V**ibes | Challenge 4 |

Challenge 5 (the keyboard) doesn't set a letter. It fine-tunes your font and fills your card stats.

### The 16 types
| Code | Name | Font (Google Fonts) |
|---|---|---|
| BGRK | The Letterpress Boss | Playfair Display (900) |
| BGRV | The Arcade Cabinet | Press Start 2P |
| BGNK | The Swiss Machine | Archivo Black |
| BGNV | The Billboard Brat | Anton |
| BFRK | The Neon Diner | Monoton |
| BFRV | The Pixel Punk | Silkscreen |
| BFNK | The Chrome Kid | Unbounded |
| BFNV | The Chaos Engine | Rubik Glitch |
| LGRK | The Old Soul | EB Garamond |
| LGRV | The Typewriter Poet | Special Elite |
| LGNK | The Quiet Modernist | Work Sans (300) |
| LGNV | The Terminal Dreamer | VT323 |
| LFRK | The Art Deco Ghost | Josefin Sans (300) |
| LFRV | The Scrapbook Heart | Caveat |
| LFNK | The Soft Futurist | Space Grotesk (300) |
| LFNV | The Cloud Doodler | Comfortaa |

(Names and fonts are placeholders. Anvii will rename them.)

---

## 3. The flow (about 2 minutes)
1. **Boot.** Win95-style boot screen, a chime, then a desktop with an "untitled – Paint" window.
2. **Lobby.** Host taps **Create room** and gets a 4-letter room code + QR. The guest taps **Join** and enters the code. Both see each other's name. Host taps **Start**.
3. **Draw yourself: 15s.** Pixel grid (24×24) with the Paint palette, a pencil, a fill bucket and an eraser. Timer in the title bar. When time's up the canvas locks. **This drawing is your avatar on the card.** (No mascot. You are the mascot.)
4. **5 timed challenges**, played at the same time by both players (see section 4). After each one, a quick "both done ✓" reveal shows what each player picked.
5. **Your Type Card:** a Win95 "Properties" window with your pixel self-portrait, name, Type Code, type name, font specimen and stat bars. **Download as PNG.**
6. **Compatibility:** both cards side by side, plus a **% match** and a **font pairing verdict**.
7. **Play again / new room.**

**Separately, but together:** each player answers alone on their own phone, but the rounds start at the same moment and results are revealed together.

---

## 4. The 5 challenges (all timed, max 5)
Each one is a Paint-style dialog window with a countdown bar in the title bar.

| # | Name | Time | What you do | Scoring |
|---|---|---|---|---|
| 1 | **Make It Loud** | 10s | A poster headline. Drag the **weight** and **size** sliders, then hit OK. | high weight + size → **B**, else **L** |
| 2 | **Snap Or Not** | 12s | Drag 4 shapes onto a canvas. A small "snap to grid" checkbox is visible. | most shapes aligned to grid / snap left on → **G**, else **F** |
| 3 | **Rapid Fire** | 8s | 5 this-or-that picks, tap fast: floppy/cloud, serif/sans, CRT/OLED, film/digital, 1998/2026 | majority retro → **R**, else **N** |
| 4 | **Even It Out** | 12s | The word TYPE with lumpy spacing. Slide letters left/right. Gap bars show under each gap. | evenness score ≥ threshold → **K**, else **V** |
| 5 | **Type Your Name** | 10s | Pixel on-screen keyboard. Type your name. Letters appear live in your font. | typing speed, backspaces → card stats ("Undo Dependency", "Speed") |

If the timer runs out, the current state is scored as is. **Running out of time is data, not failure.**

---

## 5. Compatibility (font pairing logic)
Score each axis, then add them up (max 100):
- **Volume:** different = +30 (headline + body, a classic pairing) · same = +10
- **Structure:** same = +25 (you'd share a grid) · different = +10
- **Era:** different = +20 (old meets new) · same = +15
- **Precision:** same = +25 (no kerning fights) · different = +5

Verdict lines, chosen by score:
- 85+ : "a classic pairing. print it."
- 65–84 : "works with some tracking adjustments."
- 45–64 : "a bold combo. art directors will talk."
- <45 : "font clash. beautiful chaos."

Plus one line naming the actual pair: *"Playfair Display × Space Grotesk"*.

---

## 6. Look & feel
- **Win95 / MS Paint UI** using **98.css** (MIT-licensed). Grey windows `#C0C0C0`, navy title bars `#000080`, bevelled buttons.
- **Desktop wallpaper:** a soft pink `#F4C6D7` or a sky gradient, with pixel desktop icons (folder, floppy, CD, trash, help).
- **Pixel type for UI:** `VT323` / `Silkscreen` / `Pixelify Sans`.
- **Halftone + pixel textures**, pixel starbursts, a big pixel cursor.
- **Original artwork only:** no Microsoft logos, no Clippy, no Windows flag. Generic retro-OS style.
- **Mobile-first** (portrait phone). Must also work on a laptop.

## 7. Sound
Synthesised with the **Web Audio API** (no audio files, no copyright issues):
- boot chime (3-note arpeggio) · click · error "bonk" when time's up
- tick for the last 3 seconds · "ding" when a challenge is done
- level-up jingle on the Type Card reveal
- **mute toggle** in the taskbar. Sound only starts after the first tap (browser rule).

---

## 8. Tech
- **p5.js** (+ plain HTML/CSS). Use p5 for the pixel drawing canvas, the challenge canvases and rendering the Type Card PNG.
- **98.css** from unpkg for the windows.
- **Live multiplayer: PeerJS** (WebRTC, free public broker, no server to run).
  - Host = room. Room code = 4 letters, used as the peer id with a prefix (`wyt-ABCD`).
  - **Host is the referee:** it sends `{type:'start', round, at}` and both clients start the countdown together.
  - Messages: `hello{name}`, `start{round}`, `result{round, data}`, `avatar{pixels}`, `card{...}`, `rematch`.
  - Avatar sent as palette indices (24×24 = 576 small numbers). Tiny.
- **Fallback: Compare by Code.** If the connection fails, or you're playing solo, every card gets a **share code** (Type Code + compressed avatar, base64url) plus a QR. The other person pastes or scans it to see compatibility. **This must work 100% offline from the server.**
- **Hosting:** GitHub repo → GitHub Pages or Vercel (static, no build step).
- No accounts, no database. Optional OpenAI key for a fancier write-up is a stretch goal only.

## 9. File structure (suggested)
```
index.html          screens: boot, lobby, draw, challenges, card, compat
style.css           98.css overrides, desktop, pixel stuff
js/main.js          state machine (screens) + p5 sketch setup
js/net.js           PeerJS room logic + fallback share codes
js/draw.js          15s pixel self-portrait
js/challenges.js    the 5 challenges (each: setup, draw, score)
js/types.js         16 types, fonts, scoring, compatibility
js/sound.js         Web Audio synth sounds
js/card.js          Type Card render + PNG download
assets/icons/       pixel icons (Anvii's own, or drawn in code)
```

## 10. Priorities (showcase tomorrow)
1. **MUST:** solo flow end to end on a phone: draw → 5 challenges → Type Card → download PNG
2. **MUST:** compare-by-code compatibility (the fallback)
3. **SHOULD:** live 2-player room with PeerJS
4. **SHOULD:** sounds + boot screen
5. **NICE:** QR codes, rematch, AI write-up, animations

## 11. Showcase checklist
- [ ] Test the live room on **two phones on the venue wifi**, and on a phone hotspot as a backup
- [ ] Have the compare-by-code fallback ready to demo
- [ ] Bring a laptop with the site open as the "host" screen
- [ ] Print 2–3 example Type Cards to put on the table
- [ ] QR code on the table pointing to the live URL

# Prompts to paste into Claude Code (in order)

Run `claude` inside this repo folder. Paste one prompt, test it in the browser, then go to the next.
To test locally: `python3 serve.py`, then open http://localhost:8000 (use your phone on the same wifi with your laptop's IP for phone testing).

---

### 1. Skeleton + look
> Read BRIEF.md and CLAUDE.md. Set up the static site: index.html, style.css and the js/ files from section 9. Add 98.css, p5.js and pixel Google Fonts. Build the desktop (pink wallpaper, pixel desktop icons drawn in code, a taskbar with a clock and a mute button) and an "untitled – Paint" window that will host every screen. Add a simple screen state machine: boot → lobby → draw → challenge1..5 → card → compat. Make the boot screen work with a fake progress bar. Mobile-first.

### 2. Sounds
> Build js/sound.js with Web Audio synth sounds from BRIEF.md section 7 (boot chime, click, tick, ding, bonk, level-up). Unlock audio on first tap. Hook the mute button.

### 3. Draw yourself (15s)
> Build js/draw.js: a 24×24 pixel canvas in p5 inside the Paint window, a Paint-style tool column (pencil, fill bucket, eraser) and the 28-colour Paint palette at the bottom. A 15-second countdown in the title bar, ticks in the last 3 seconds, the canvas locks at 0. Store the avatar as an array of palette indices.

### 4. The 5 challenges
> Build js/challenges.js with the 5 timed challenges from BRIEF.md section 4, each in its own Win95 dialog with a countdown bar. Each challenge exports {setup, draw, score} and returns a result object. Score letters B/L, G/F, R/N, K/V exactly as specified. Challenge 5 (pixel keyboard) records speed + backspaces. Running out of time scores the current state.

### 5. Types + Type Card
> Build js/types.js (the 16 types, fonts, scoring) and js/card.js. Render the Type Card in a p5 graphics buffer as a Win95 "Properties" window: pixel avatar, name, 4-letter code, type name, font specimen of the name in the type's font, stat bars. Add a "Download PNG" button (on iPhone, open the image in a new tab so they can long-press to save).

**Checkpoint: the solo flow should now work end to end. Test it on your phone.**

### 6. Compare by Code (fallback)
> In js/net.js, create a share code for each card (Type Code + avatar palette indices, compressed, base64url) and show it with a copy button and a QR code. Add an "Enter friend's code" field that decodes it and opens the compat screen. Build the compat screen from BRIEF.md section 5: both cards side by side, % match, verdict line, font pair line.

### 7. Live 2-player rooms
> Add PeerJS live rooms from BRIEF.md section 8. Host: create a room with a 4-letter code + QR. Guest: join by code. Show both names in the lobby. Host is the referee and starts each round for both players at the same time. Show "opponent finished ✓" during rounds and reveal both answers after each round. Exchange avatars and cards at the end, then go to the compat screen. If connecting fails after 8 seconds, show a Win95 error dialog offering "Play solo + compare by code".

### 8. Polish
> Polish pass: pixel starbursts and halftone textures on the desktop, a pixel cursor, a screen-shake/glitch when time runs out, a level-up animation on card reveal, a rematch button. Keep all copy short. Test at 390×844 and on desktop.

### 9. Ship
> Make sure everything works from a static host. Write a README with how to run it and a short "how it works" section. Commit and push. Then help me turn on GitHub Pages for this repo.

# CLAUDE.md · rules for Claude Code in this repo

Read `BRIEF.md` first. It is the source of truth for the concept, the challenges, scoring and tech.

## Who I am
I'm Anvii, an Industrial Design student at NUS (ID2116 Computing for Design). This is my Project 02, showing at a showcase. I'm a designer first, so explain code in plain words when I ask.

## How to work with me
- Build in small, working steps. After each step, tell me how to test it in the browser.
- Prefer **complete file replacements** over tiny diffs when you change a file.
- Ask before adding any new library beyond: p5.js, 98.css, PeerJS, a QR library.
- Never break the solo flow. Run through it after every change.
- Commit after every working step with a clear message.

## Code rules
- Static site: plain HTML + CSS + JS + **p5.js**. No build step, no frameworks, no npm needed to run.
- Load libraries from CDN (unpkg / jsdelivr / cdnjs).
- Mobile-first. Test at 390×844 (phone portrait) and on desktop.
- All touch interactions must work with fingers (pointer events, big hit areas, no hover-only UI).
- Keep the copy SHORT. Instructions 2–6 words max. No walls of text.
- Never use em dashes in UI copy.

## Visual rules
- Win95 / MS Paint style via 98.css. Original art only: **no Microsoft logos, no Clippy, no Windows flag.**
- Pixel fonts for UI (VT323, Silkscreen, Pixelify Sans). Result fonts come from the 16-type table in BRIEF.md.
- Palette: window grey #C0C0C0, title navy #000080, desktop pink #F4C6D7, plus the classic 28-colour Paint palette inside the drawing tool.

## Sound
- Web Audio API synth only (no audio files). Start audio after the first user tap. Always include a mute button.

## Multiplayer
- PeerJS, host-as-referee (see BRIEF.md section 8).
- The **compare-by-code fallback must always work**, even with zero network.

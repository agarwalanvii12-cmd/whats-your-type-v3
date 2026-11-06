"""Local dev server for What's Your Type?!

Same as `python3 -m http.server`, but:
- tells the browser never to cache, so every reload shows your latest changes
- runs local copies of the live-room relay (/api/room) and the Card Wall
  (/api/gallery), kept in memory, so they work on your laptop like on Vercel

The AI (/api/ai) only runs on Vercel; locally the game uses its offline reading.

Run:  python3 serve.py        then open http://localhost:8000
"""
import http.server
import json
import random
import re
import socketserver
import threading
import time

PORT = 8000
LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
ROOMS = {}            # code -> {"host", "guest", "seen": {}, "to": {"host": [], "guest": []}, "t"}
WALL = []             # pinned cards (share codes), newest first
LOCK = threading.Lock()


def clean_name(n):
    n = re.sub(r"[^\w '._-]", "", str(n or ""), flags=re.UNICODE).strip()[:12]
    return n or "Anon"


def room_api(body):
    """Mirror of api/room.js. Returns (status, json)."""
    now = time.time() * 1000
    action = body.get("action")
    with LOCK:
        # forget rooms older than 3 hours
        for c in [c for c, r in ROOMS.items() if now - r["t"] > 3 * 3600 * 1000]:
            del ROOMS[c]

        if action == "create":
            for _ in range(50):
                code = "".join(random.choice(LETTERS) for _ in range(4))
                if code not in ROOMS:
                    ROOMS[code] = {"host": clean_name(body.get("name")), "guest": None,
                                   "seen": {"host": now}, "to": {"host": [], "guest": []}, "t": now}
                    return 200, {"code": code}
            return 503, {"error": "No free room codes"}

        code = re.sub(r"[^A-Z]", "", str(body.get("code", "")).upper())[:4]
        room = ROOMS.get(code)

        if action == "join":
            if not room:
                return 404, {"error": f"No room called {code}"}
            if room["guest"]:
                return 409, {"error": f"Room {code} is full"}
            room["guest"] = clean_name(body.get("name"))
            room["seen"]["guest"] = now
            room["to"]["guest"] = []
            return 200, {"host": room["host"]}

        me = body.get("me")
        if me not in ("host", "guest"):
            return 400, {"error": "Bad player"}
        other = "guest" if me == "host" else "host"
        if not room:
            return 404, {"error": "Room gone"}

        if action == "send":
            room["to"][other].append(body.get("msg"))
            room["seen"][me] = now
            return 200, {"ok": True}
        if action == "poll":
            msgs, room["to"][me] = room["to"][me], []
            room["seen"][me] = now
            seen = room["seen"].get(other)
            return 200, {"msgs": msgs, "oppAgo": (now - seen) if seen else None}
        if action == "leave":
            room["to"][other].append({"type": "bye"})
            room[me] = None
            room["seen"].pop(me, None)
            room["to"][me] = []
            if not room["host"] and not room["guest"]:
                del ROOMS[code]
            return 200, {"ok": True}
    return 400, {"error": "Bad action"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_json(self, status, data):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/room":
            return self.send_json(200, {"relay": True})
        if self.path.split("?")[0] == "/api/gallery":
            return self.send_json(200, {"cards": WALL[:60]})
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in ("/api/room", "/api/gallery"):
            return self.send_json(404, {"error": "Not here"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self.send_json(400, {"error": "Bad request"})
        if path == "/api/gallery":
            share = str(body.get("share", ""))
            if not re.fullmatch(r"[A-Za-z0-9_-]{20,900}", share):
                return self.send_json(400, {"error": "Bad card"})
            with LOCK:
                if share in WALL:
                    WALL.remove(share)
                WALL.insert(0, share)
                del WALL[60:]
            return self.send_json(200, {"ok": True})
        status, data = room_api(body)
        self.send_json(status, data)

    def log_message(self, fmt, *args):
        if "/api/" not in (args[0] if args else ""):  # don't spam the terminal with polls
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("", PORT), Handler) as httpd:
        print(f"Serving on http://localhost:{PORT}  (Ctrl+C to stop)")
        httpd.serve_forever()

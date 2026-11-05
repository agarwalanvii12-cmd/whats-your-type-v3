"""Local dev server for What's Your Type?!

Same as `python3 -m http.server`, but tells the browser never to cache,
so every reload (on laptop or phone) shows your latest changes.

Run:  python3 serve.py        then open http://localhost:8000
"""
import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving on http://localhost:{PORT}  (Ctrl+C to stop)")
        httpd.serve_forever()

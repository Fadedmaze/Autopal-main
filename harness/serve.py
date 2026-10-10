"""Local test harness: serves the app with js/supabaseClient.js swapped for the
in-memory stub, and no caching (so every reload runs the latest code).
Usage: python3 harness/serve.py [port]   then open http://localhost:PORT/?scenario=full|empty|signedout
"""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB = os.path.join(ROOT, "harness", "supabaseClient.stub.js")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def translate_path(self, path):
        if path.split("?")[0] == "/js/supabaseClient.js":
            return STUB
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

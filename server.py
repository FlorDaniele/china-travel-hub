#!/usr/bin/env python3
"""Dev HTTP server with Cache-Control: no-store on all responses.
Prevents browser from serving stale JS modules between reloads.
Usage: python3 server.py [port]
"""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # suppress request logs

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
print(f'Serving on http://localhost:{port} (no-cache)')
with http.server.HTTPServer(('', port), NoCacheHandler) as httpd:
    httpd.serve_forever()

import http.server
import socketserver


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8765), NoCache) as server:
    print("RoomFix Map en http://127.0.0.1:8765")
    server.serve_forever()

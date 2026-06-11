import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient

# Load env variables or use default cloud cluster credentials
CLOUD_URL = os.environ.get("QDRANT_URL", "https://5873dbdf-1cbf-45c8-a25d-c8a202860fd5.europe-west6-0.gcp.cloud.qdrant.io")
API_KEY = os.environ.get("QDRANT_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6N2E2ZDAyYTEtNWM1My00YzQ5LThmM2MtMDE5OGQ3ODM1NDkzIn0.60HKrO2Dn6iwiPeNe7QZaHIEhVggxM837Bd8A7WAGIc")
COLLECTION_NAME = "maternal_newborn_nursing_bge"
EMBEDDING_MODEL_NAME = "BAAI/bge-large-en-v1.5"

print("Loading SentenceTransformer model (this takes a moment)...")
embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
print("Connecting to Qdrant Cloud client...")
qdrant = QdrantClient(url=CLOUD_URL, api_key=API_KEY, timeout=60)
print("RAG Server is ready!")

class RAGRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/query':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                query_text = payload.get('query', '')
                top_k = payload.get('top_k', 5)
                
                if not query_text:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "No query provided"}).encode('utf-8'))
                    return
                
                query_vec = embedder.encode([query_text], normalize_embeddings=True)[0].tolist()
                results = qdrant.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_vec,
                    using="text-dense",
                    limit=top_k
                ).points
                
                output = []
                for chunk in results:
                    output.append({
                        "page": chunk.payload.get("page", "Unknown"),
                        "text": chunk.payload.get("text", ""),
                        "score": chunk.score
                    })
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"results": output}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=5005):
    server_address = ('', port)
    httpd = HTTPServer(server_address, RAGRequestHandler)
    print(f"Starting RAG HTTP server on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()

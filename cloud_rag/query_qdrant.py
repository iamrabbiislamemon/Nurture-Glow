import sys
import os
import json
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient

# Load env variables or use default cloud cluster credentials
CLOUD_URL = os.environ.get("QDRANT_URL", "https://5873dbdf-1cbf-45c8-a25d-c8a202860fd5.europe-west6-0.gcp.cloud.qdrant.io")
API_KEY = os.environ.get("QDRANT_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6N2E2ZDAyYTEtNWM1My00YzQ5LThmM2MtMDE5OGQ3ODM1NDkzIn0.60HKrO2Dn6iwiPeNe7QZaHIEhVggxM837Bd8A7WAGIc")
COLLECTION_NAME = "maternal_newborn_nursing_bge"
EMBEDDING_MODEL_NAME = "BAAI/bge-large-en-v1.5"

def query_qdrant(query_text, top_k=5):
    # Lazy imports or loading
    embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
    qdrant = QdrantClient(url=CLOUD_URL, api_key=API_KEY, timeout=60)
    query_vec = embedder.encode([query_text], normalize_embeddings=True)[0].tolist()
    
    # query_points replaces search() in newer Qdrant APIs
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
    return output

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)
        
    query_text = sys.argv[1]
    try:
        results = query_qdrant(query_text)
        print(json.dumps({"results": results}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

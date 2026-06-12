import os
import json
import numpy as np
import requests
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from llama_cpp import Llama
from pathlib import Path

# Environment variables (set in docker-compose)
QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", 6333))
COLLECTION_NAME = "maternal_newborn_nursing_bge"
MODEL_PATH = os.environ.get("MODEL_PATH", "models/your_model.gguf")
EMBEDDING_MODEL_NAME = "BAAI/bge-large-en-v1.5"
TOP_K = 5

# Lazy loading
_embedder = None
_llm = None
_qdrant = None

def get_embedder():
    global _embedder
    if _embedder is None:
        print("Loading embedding model...")
        _embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedder

def get_qdrant():
    global _qdrant
    if _qdrant is None:
        # 🛠️ Configuration for Qdrant Cloud Cluster
        CLOUD_URL = os.environ.get("QDRANT_URL", "https://5873dbdf-1cbf-45c8-a25d-c8a202860fd5.europe-west6-0.gcp.cloud.qdrant.io")
        API_KEY = os.environ.get("QDRANT_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6N2E2ZDAyYTEtNWM1My00YzQ5LThmM2MtMDE5OGQ3ODM1NDkzIn0.60HKrO2Dn6iwiPeNe7QZaHIEhVggxM837Bd8A7WAGIc")
        
        print("Connecting to secure Qdrant Cloud cluster...")
        _qdrant = QdrantClient(
            url=CLOUD_URL, 
            api_key=API_KEY,
            timeout=60
        )
    return _qdrant

def get_llm():
    global _llm
    if _llm is None:
        print(f"Loading LLM from {MODEL_PATH}")
        # Read layers from environment if available, otherwise default to 0 for pure CPU stability
        gpu_layers = int(os.environ.get("REPLACE_GPU_LAYERS", 0)) 
        
        _llm = Llama(
            model_path=MODEL_PATH,
            n_ctx=2048,
            n_gpu_layers=gpu_layers,   
            verbose=False
        )
    return _llm

def retrieve(query, top_k=TOP_K):
    embedder = get_embedder()
    qdrant = get_qdrant()
    query_vec = embedder.encode([query], normalize_embeddings=True)[0].tolist()
    
    # 🛠️ Changed from .search() to .query_points()
    results = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vec,              # Note: renamed from query_vector to query
        using="text-dense",            # Note: renamed from vector_name to using
        limit=top_k
    ).points                           # Note: Appended .points to unpack the list directly
    return results

def format_prompt(query, retrieved_chunks):
    context = "\n\n---\n\n".join([
        f"Source (page {chunk.payload['page']}):\n{chunk.payload['text']}"
        for chunk in retrieved_chunks
    ])
    prompt = f"""You are an expert maternal-newborn nurse assistant. Answer the user's question based ONLY on the provided textbook excerpts. If the answer is not found in the excerpts, say "I cannot find that information in the provided text."

### Context:
{context}

### Question:
{query}

### Answer:"""
    return prompt

def answer_question(query):
    retrieved = retrieve(query)
    if not retrieved:
        return "No relevant information found.", []
    prompt = format_prompt(query, retrieved)

    # Check if NVIDIA / OpenAI API is configured for cloud inference
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://integrate.api.nvidia.com/v1")
    model = os.environ.get("OPENAI_MODEL", "minimaxai/minimax-m2.7")

    if api_key:
        print(f"Generating answer via cloud LLM ({model}) using NVIDIA API...")
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 512,
                "stream": False
            }
            res = requests.post(f"{base_url.rstrip('/')}/chat/completions", headers=headers, json=payload, timeout=30)
            if res.ok:
                data = res.json()
                answer = data["choices"][0]["message"]["content"].strip()
                return answer, retrieved
            else:
                print(f"NVIDIA API request failed with status {res.status_code}: {res.text}. Falling back to local LLM.")
        except Exception as e:
            print(f"Failed to query cloud LLM: {e}. Falling back to local LLM.")

    # Fallback to local LLM
    llm = get_llm()
    response = llm(
        prompt,
        max_tokens=512,
        temperature=0.2,
        stop=["###", "\n\n"],
        echo=False
    )
    answer = response["choices"][0]["text"].strip()
    return answer, retrieved

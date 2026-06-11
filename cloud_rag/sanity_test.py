import time
from rag_chain import answer_question

def run_test():
    # A highly specific clinical question to test if it pulls the exact right pages
    query = "What are the immediate nursing interventions for a newborn showing signs of respiratory distress?"
    
    print("=" * 60)
    print(f"🚀 STARTING RAG SANITY TEST")
    print(f"❓ Question: '{query}'")
    print("=" * 60)
    
    print("\n⏳ Step 1: Querying Qdrant Cloud and generating response via LLM...")
    start_time = time.time()
    
    try:
        # ✅ RESTORED: Invoking the full end-to-end RAG chain function
        answer, source_chunks = answer_question(query)
        elapsed_time = time.time() - start_time
        
        print(f"🏁 Completed in {elapsed_time:.2f} seconds.")
        
        # --- VERIFY SOURCES ---
        print("\n=== 📚 SOURCES RETRIEVED FROM QDRANT CLOUD ===")
        if not source_chunks:
            print("❌ No sources returned! Check your collection name or vector configuration.")
        else:
            for i, chunk in enumerate(source_chunks, 1):
                page = chunk.payload.get('page', 'Unknown')
                text_snippet = chunk.payload.get('text', '').replace('\n', ' ')[:120]
                print(f" [{i}] Page {page} (Match Score: {chunk.score:.4f}):")
                print(f"     \"{text_snippet}...\"")
        
        # --- VERIFY ANSWER ---
        print("\n=== 🤖 LLM GENERATED ANSWER ===")
        print(answer)
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR during execution:")
        print(str(e))
        print("=" * 60)

if __name__ == "__main__":
    run_test()
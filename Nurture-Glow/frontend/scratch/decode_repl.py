import json

def decode_file(input_path, output_path):
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Parse it as a JSON string to decode backslashes, quotes, and newlines
        decoded = json.loads(content)
        
        with open(output_path, "w", encoding="utf-8") as out:
            out.write(decoded)
        print(f"Decoded {input_path} to {output_path}")
    except Exception as e:
        print(f"Error decoding {input_path}: {e}")

decode_file(
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_415_repl.txt",
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_415_decoded.txt"
)
decode_file(
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_423_repl.txt",
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_423_decoded.txt"
)
decode_file(
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_427_repl.txt",
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_427_decoded.txt"
)
decode_file(
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_543_repl.txt",
    r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\step_543_decoded.txt"
)

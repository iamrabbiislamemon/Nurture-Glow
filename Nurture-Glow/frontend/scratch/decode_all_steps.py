import json
import glob
import os

files = glob.glob(r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\scratch\all_step_*.txt")

for f_path in files:
    try:
        with open(f_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
        
        # If it starts and ends with double quotes, it's JSON encoded
        if content.startswith('"') and content.endswith('"'):
            # Let's try parsing it as a JSON string
            try:
                decoded = json.loads(content, strict=False)
            except Exception as e:
                # Fallback: manually replace escaped quotes and newlines
                decoded = content[1:-1].replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
        else:
            # Let's try parsing it as a JSON string just in case
            try:
                # Add quotes around it to make it a JSON string
                decoded = json.loads('"' + content + '"', strict=False)
            except Exception as e:
                # Fallback
                decoded = content.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
        
        base = os.path.basename(f_path)
        name_part = base.replace(".txt", "_decoded.txt")
        out_path = f"C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\3027f120-6faf-4123-b6b9-33f82b5ea42c\\scratch\\{name_part}"
        
        with open(out_path, "w", encoding="utf-8") as out:
            out.write(decoded)
        print(f"Decoded {base} to {name_part} successfully")
    except Exception as e:
        print(f"Error decoding {f_path}: {e}")

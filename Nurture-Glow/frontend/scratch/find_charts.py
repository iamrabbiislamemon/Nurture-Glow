import json
import os

log_file = r"C:\Users\Administrator\.gemini\antigravity\brain\3027f120-6faf-4123-b6b9-33f82b5ea42c\.system_generated\logs\transcript.jsonl"

if not os.path.exists(log_file):
    print("Log file not found")
    exit(1)

with open(log_file, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            tool_calls = data.get("tool_calls", [])
            for tc in tool_calls:
                name = tc.get("name")
                args = tc.get("args", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except:
                        pass
                
                if name == "replace_file_content" and "Dashboard.tsx" in str(args.get("TargetFile", "")):
                    repl = args.get("ReplacementContent", "")
                    if "activeChartTab" in repl or "vitals" in repl or "Maternal Health Analytics" in repl or "Activity Chart" in repl:
                        step_idx = data.get('step_index')
                        output_path = f"C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\3027f120-6faf-4123-b6b9-33f82b5ea42c\\scratch\\step_{step_idx}_repl.txt"
                        with open(output_path, "w", encoding="utf-8") as out_f:
                            out_f.write(repl)
                        print(f"Successfully wrote step {step_idx} content to: {output_path}")
        except Exception as e:
            pass

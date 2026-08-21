import subprocess
import json

res = subprocess.run(['pyright', 'src', '--outputjson'], capture_output=True, text=True, shell=True)
try:
    data = json.loads(res.stdout)
    diags = data.get('generalDiagnostics', [])
    print(f"Total diagnostics: {len(diags)}")
    for i, diag in enumerate(diags, 1):
        rule = diag.get('rule', '')
        print(f"[{i}/{len(diags)}] {diag['file']}:{diag['range']['start']['line']+1} - [{diag['severity']}] {diag['message']} ({rule})")
except Exception as e:
    print("Error parsing json:", e)


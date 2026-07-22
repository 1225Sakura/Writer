"""Quick script to enumerate unique frontend /api/v1/ URL patterns."""
import re
from pathlib import Path

FRONTEND_API = Path(r"D:\writer\src\frontend\src\api")
URL_PATTERN = re.compile(r"`(/api/v1/[a-zA-Z0-9_/{}\-\$\{\}]+)`")
URL_PATTERN2 = re.compile(r"'/api/v1/([a-zA-Z0-9_/{}\-]+)'")
URL_PATTERN3 = re.compile(r'"/api/v1/([a-zA-Z0-9_/{}\-]+)"')

urls = set()
for f in FRONTEND_API.glob("*.ts"):
    content = f.read_text(encoding="utf-8")
    for m in URL_PATTERN.findall(content):
        # Strip template literal placeholders for normalized matching
        normalized = re.sub(r"\$\{[^}]+\}", "{}", m)
        urls.add(normalized)
    for m in URL_PATTERN2.findall(content):
        urls.add(f"/api/v1/{m}")
    for m in URL_PATTERN3.findall(content):
        urls.add(f"/api/v1/{m}")

print(f"Total unique URL patterns: {len(urls)}")
for u in sorted(urls):
    print(f"  {u}")
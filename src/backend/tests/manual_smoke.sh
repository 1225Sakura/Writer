#!/usr/bin/env bash
# Manual smoke test: 7-step user story
set -e
cd "$(dirname "$0")/.."

BASE=http://127.0.0.1:8000/api/v1
PROJ_ID=1

echo "=== Step 1: Create project ==="
PROJECT=$(curl -s -X POST "$BASE/projects" -H 'Content-Type: application/json' \
    -d '{"name":"Smoke Test Novel","genre":"玄幻","description":"Smoke test"}')
echo "$PROJECT"
PID=$(echo "$PROJECT" | python -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "Created project id=$PID"

echo "=== Step 2: Create character ==="
CHAR=$(curl -s -X POST "$BASE/settings/characters" -H 'Content-Type: application/json' \
    -d "{\"project_id\":$PID,\"name\":\"主角\"}")
echo "$CHAR"

echo "=== Step 3: Create item ==="
ITEM=$(curl -s -X POST "$BASE/settings/items" -H 'Content-Type: application/json' \
    -d "{\"project_id\":$PID,\"name\":\"宝剑\"}")
echo "$ITEM"

echo "=== Step 4: Create location ==="
LOC=$(curl -s -X POST "$BASE/settings/locations" -H 'Content-Type: application/json' \
    -d "{\"project_id\":$PID,\"name\":\"青云山\"}")
echo "$LOC"

echo "=== Step 5: Create outline ==="
OUT=$(curl -s -X POST "$BASE/chapters/outlines" -H 'Content-Type: application/json' \
    -d "{\"project_id\":$PID,\"title\":\"第一章 大纲\",\"summary\":\"主角出山\",\"target_chapter\":1}")
echo "$OUT"
OID=$(echo "$OUT" | python -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

echo "=== Step 6: Create chapter + draft ==="
CH=$(curl -s -X POST "$BASE/chapters" -H 'Content-Type: application/json' \
    -d "{\"outline_id\":$OID,\"project_id\":$PID,\"title\":\"第一章\",\"summary\":\"开始\"}")
CID=$(echo "$CH" | python -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "Created chapter id=$CID"

DRAFT=$(curl -s -X POST "$BASE/chapters/$CID/drafts" -H 'Content-Type: application/json' \
    -d '{"content":"这是第一章的开头。"}')
echo "$DRAFT"

echo "=== Step 7: Verify GET chapter shows draft content ==="
GET=$(curl -s "$BASE/chapters/$CID")
echo "$GET"
CONTENT=$(echo "$GET" | python -c "import sys, json; print(json.load(sys.stdin)['data'].get('content',''))")
if [[ "$CONTENT" == *"这是第一章的开头"* ]]; then
    echo "✅ SMOKE TEST PASSED"
else
    echo "❌ SMOKE TEST FAILED: draft content not in chapter response"
    echo "Got: $CONTENT"
    exit 1
fi
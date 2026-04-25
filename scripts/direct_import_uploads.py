import json
import re
import sqlite3
import sys
import time
import uuid
from html import escape
from pathlib import Path

ROOT = Path(sys.argv[1])
DB_PATH = Path(sys.argv[2])
IMPORT_DIR = Path(sys.argv[3])

if not IMPORT_DIR.exists():
    raise SystemExit(f"Import folder not found: {IMPORT_DIR}")

conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def now_ms():
    return int(time.time() * 1000)

def cols(table):
    return [r["name"] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]

def has_table(name):
    row = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (name,)
    ).fetchone()
    return bool(row)

def first_nonempty(*vals):
    for v in vals:
        if isinstance(v, str):
            v2 = v.strip()
            if v2:
                return v2
    return None

def strip_html(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()

def esc_html(s):
    return escape(s or "", quote=True)

def parse_chapter_from_filename(name: str):
    patterns = [
        r'(?i)^(\d{2,3})[_\-]',
        r'(?i)[_\-](\d{2,3})\.(?:json|html|htm|csv)$',
        r'(?i)\bchapter[_\- ]?(\d{2,3})\b',
        r'(?i)\bch[_\- ]?(\d{2,3})\b',
        r'(?i)(\d{2,3})(?!.*\d)',
    ]
    for p in patterns:
        m = re.search(p, name)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 300:
                return n
    return None

def parse_chapter_from_item(item, fallback_name=""):
    candidates = [
        item.get("chapterNo"),
        item.get("chapter_no"),
        item.get("chapter"),
        item.get("__chapterNo"),
        item.get("sourceChapter"),
        item.get("chapter_number"),
        item.get("__sourceFileName"),
        item.get("source_file"),
        item.get("fileName"),
        item.get("filename"),
        item.get("name"),
        item.get("title"),
        fallback_name,
    ]
    tags = item.get("tags")
    if isinstance(tags, list):
        candidates.extend(tags)

    for c in candidates:
        if isinstance(c, int):
            if 1 <= c <= 300:
                return c
        if isinstance(c, str):
            s = c.strip()
            if not s:
                continue
            m = re.match(r'(?i)^ch-(\d{2,3})$', s)
            if m:
                return int(m.group(1))
            if re.fullmatch(r'\d{1,3}', s):
                n = int(s)
                if 1 <= n <= 300:
                    return n
            n = parse_chapter_from_filename(s)
            if n:
                return n
    return None

chapters_cols = cols("chapters")
chapters_no_col = next((c for c in ["chapterNo", "chapter_no", "chapter"] if c in chapters_cols), None)
chapters_id_col = next((c for c in ["id"] if c in chapters_cols), None)
chapters_title_col = next((c for c in ["title", "name"] if c in chapters_cols), None)

if not chapters_no_col or not chapters_id_col:
    raise SystemExit("Could not resolve chapters table columns.")

chapter_rows = cur.execute(f"SELECT {chapters_id_col} AS id, {chapters_no_col} AS chapter_no, {chapters_title_col or chapters_no_col} AS title FROM chapters").fetchall()
chapter_by_no = {int(r["chapter_no"]): {"id": r["id"], "title": r["title"]} for r in chapter_rows if r["chapter_no"] is not None}

imports_cols = cols("imports") if has_table("imports") else []
questions_cols = cols("questions")
question_options_cols = cols("question_options")
chunks_cols = cols("chunks")

def make_insert_sql(table, data):
    usable = {k: v for k, v in data.items() if k in cols(table)}
    keys = list(usable.keys())
    placeholders = ", ".join(["?"] * len(keys))
    sql = f"INSERT INTO {table} ({', '.join(keys)}) VALUES ({placeholders})"
    return sql, [usable[k] for k in keys]

def create_import_batch(source_name):
    if not imports_cols:
        return None
    import_id = str(uuid.uuid4())
    t = now_ms()
    data = {
        "id": import_id,
        "sourceName": source_name,
        "source_name": source_name,
        "sourceType": "direct-script",
        "source_type": "direct-script",
        "schemaVersion": "direct-import-v1",
        "schema_version": "direct-import-v1",
        "status": "running",
        "fileName": source_name,
        "file_name": source_name,
        "fileType": "mixed",
        "file_type": "mixed",
        "contentType": "mixed",
        "content_type": "mixed",
        "startedAt": t,
        "started_at": t,
        "createdAt": t,
        "created_at": t,
        "updatedAt": t,
        "updated_at": t,
    }
    sql, vals = make_insert_sql("imports", data)
    cur.execute(sql, vals)
    return import_id

def complete_import_batch(import_id, imported_count, errors):
    if not imports_cols or not import_id:
        return
    t = now_ms()
    sets = []
    vals = []
    mapping = {
        "status": "completed" if imported_count > 0 else "failed",
        "itemCount": imported_count,
        "item_count": imported_count,
        "completedAt": t,
        "completed_at": t,
        "updatedAt": t,
        "updated_at": t,
        "errorMessage": None if not errors else f"{len(errors)} row(s) skipped | first: {errors[0]}",
        "error_message": None if not errors else f"{len(errors)} row(s) skipped | first: {errors[0]}",
    }
    for k, v in mapping.items():
        if k in imports_cols:
            sets.append(f"{k} = ?")
            vals.append(v)
    vals.append(import_id)
    cur.execute(f"UPDATE imports SET {', '.join(sets)} WHERE id = ?", vals)

def normalize_options(item):
    raw = item.get("options")
    if not isinstance(raw, list):
        return []
    keys = ["A","B","C","D","E","F","G","H"]
    out = []
    for i, opt in enumerate(raw):
        if isinstance(opt, str):
            txt = opt.strip()
            if txt:
                out.append({
                    "key": keys[i] if i < len(keys) else str(i+1),
                    "text": txt,
                    "html": f"<p>{esc_html(txt)}</p>",
                    "raw_id": None,
                    "i": i,
                })
        elif isinstance(opt, dict):
            html = first_nonempty(opt.get("contentHtml"), opt.get("html"))
            txt = first_nonempty(opt.get("contentText"), opt.get("text"), opt.get("label")) or (strip_html(html) if html else "")
            if txt or html:
                out.append({
                    "key": first_nonempty(opt.get("optionKey"), opt.get("key"), opt.get("label")) or (keys[i] if i < len(keys) else str(i+1)),
                    "text": txt or "",
                    "html": html or f"<p>{esc_html(txt or '')}</p>",
                    "raw_id": first_nonempty(opt.get("id")),
                    "i": i,
                    "is_correct": opt.get("isCorrect") is True,
                })
    return out

def find_answer_index(item, options):
    if not options:
        return -1

    direct_candidates = [item.get("answer"), item.get("correctAnswer"), item.get("correctIndex"), item.get("answerIndex")]
    for c in direct_candidates:
        if isinstance(c, int) and 0 <= c < len(options):
            return c
        if isinstance(c, str) and c.strip().isdigit():
            n = int(c.strip())
            if 0 <= n < len(options):
                return n
            if 1 <= n <= len(options):
                return n - 1

    key_candidates = []
    for c in [item.get("correct"), item.get("correctAnswer"), item.get("answer"), item.get("correctOptionKey"), item.get("correctOptionId")]:
        if isinstance(c, str) and c.strip():
            key_candidates.append(c.strip())

    letters = ["A","B","C","D","E","F","G","H"]
    for cand in key_candidates:
        upper = cand.upper()
        if upper in letters:
            idx = letters.index(upper)
            if idx < len(options):
                return idx
        for i, o in enumerate(options):
            if (o["key"] or "").upper() == upper:
                return i
            if o.get("raw_id") and o["raw_id"] == cand:
                return i

    raw = item.get("options")
    if isinstance(raw, list):
        for i, opt in enumerate(raw):
            if isinstance(opt, dict) and opt.get("isCorrect") is True:
                return i

    for i, o in enumerate(options):
        if o.get("is_correct"):
            return i

    return 0

def insert_question(item, import_id, fallback_name):
    stem = first_nonempty(item.get("text"), item.get("stem"), item.get("question"), item.get("stemText"), item.get("prompt"))
    if not stem:
        raise ValueError("question text is empty")

    chapter_no = parse_chapter_from_item(item, fallback_name)
    if not chapter_no or chapter_no not in chapter_by_no:
        raise ValueError(f"chapter could not be resolved (filename={fallback_name})")

    chapter_id = chapter_by_no[chapter_no]["id"]

    tags = item.get("tags")
    if isinstance(tags, list):
        tags_list = [str(x).strip() for x in tags if str(x).strip()]
    else:
        tags_list = []
    ch_tag = f"ch-{chapter_no}"
    if ch_tag not in tags_list:
        tags_list.append(ch_tag)

    options = normalize_options(item)
    if len(options) < 2:
        raise ValueError("at least 2 options required")

    answer_idx = find_answer_index(item, options)
    if answer_idx < 0 or answer_idx >= len(options):
        raise ValueError("could not resolve the correct answer")

    explanation = first_nonempty(item.get("explanation"), item.get("explanationText"), item.get("rationale")) or ""
    diff_raw = str(item.get("difficulty") or "").strip().lower()
    difficulty = diff_raw if diff_raw in ("easy", "medium", "hard") else None
    subject = first_nonempty(item.get("subject"), item.get("system"), item.get("category"))
    t = now_ms()
    q_id = str(uuid.uuid4())

    q_data = {
        "id": q_id,
        "importId": import_id,
        "import_id": import_id,
        "chapterId": chapter_id,
        "chapter_id": chapter_id,
        "stemHtml": f"<p>{esc_html(stem)}</p>",
        "stem_html": f"<p>{esc_html(stem)}</p>",
        "stemText": stem,
        "stem_text": stem,
        "questionType": "single_best_answer",
        "question_type": "single_best_answer",
        "difficulty": difficulty,
        "subject": subject,
        "tagsJson": json.dumps(tags_list) if tags_list else None,
        "tags_json": json.dumps(tags_list) if tags_list else None,
        "explanationHtml": f"<p>{esc_html(explanation)}</p>" if explanation else None,
        "explanation_html": f"<p>{esc_html(explanation)}</p>" if explanation else None,
        "isActive": 1,
        "is_active": 1,
        "createdAt": t,
        "created_at": t,
        "updatedAt": t,
        "updated_at": t,
    }
    sql, vals = make_insert_sql("questions", q_data)
    cur.execute(sql, vals)

    correct_option_id = None
    for i, opt in enumerate(options):
        opt_id = str(uuid.uuid4())
        is_correct = 1 if i == answer_idx else 0
        o_data = {
            "id": opt_id,
            "questionId": q_id,
            "question_id": q_id,
            "optionKey": opt["key"],
            "option_key": opt["key"],
            "contentHtml": opt["html"],
            "content_html": opt["html"],
            "contentText": opt["text"],
            "content_text": opt["text"],
            "isCorrect": is_correct,
            "is_correct": is_correct,
            "sortOrder": i,
            "sort_order": i,
            "createdAt": t,
            "created_at": t,
        }
        sql, vals = make_insert_sql("question_options", o_data)
        cur.execute(sql, vals)
        if is_correct:
            correct_option_id = opt_id

    if correct_option_id:
        if "correctOptionId" in questions_cols:
            cur.execute("UPDATE questions SET correctOptionId = ? WHERE id = ?", (correct_option_id, q_id))
        elif "correct_option_id" in questions_cols:
            cur.execute("UPDATE questions SET correct_option_id = ? WHERE id = ?", (correct_option_id, q_id))

def insert_chunk_from_html(file_path, import_id):
    html = file_path.read_text(encoding="utf-8", errors="ignore").strip()
    if not html:
        raise ValueError("html file is empty")

    chapter_no = parse_chapter_from_filename(file_path.name)
    if not chapter_no:
        chapter_no = parse_chapter_from_item({"fileName": file_path.name, "title": file_path.stem}, file_path.name)

    if not chapter_no or chapter_no not in chapter_by_no:
        raise ValueError(f"chapter could not be resolved for html file {file_path.name}")

    chapter_id = chapter_by_no[chapter_no]["id"]
    title = file_path.stem
    plain = strip_html(html)
    t = now_ms()

    row = cur.execute(
        "SELECT COALESCE(MAX(chunk_index), -1) AS m FROM chunks WHERE chapter_id = ?",
        (chapter_id,)
    ).fetchone()
    chunk_index = int((row["m"] if row and row["m"] is not None else -1)) + 1
    slug = f"{chapter_id}-direct-{str(uuid.uuid4())[:8]}-{chunk_index}"

    c_data = {
        "id": str(uuid.uuid4()),
        "importId": import_id,
        "import_id": import_id,
        "chapterId": chapter_id,
        "chapter_id": chapter_id,
        "chunkIndex": chunk_index,
        "chunk_index": chunk_index,
        "title": title,
        "slug": slug,
        "chunkKind": "notes",
        "chunk_kind": "notes",
        "notesHtml": html,
        "notes_html": html,
        "plainText": plain[:10000],
        "plain_text": plain[:10000],
        "wordCount": len([x for x in re.split(r"\s+", plain) if x]),
        "word_count": len([x for x in re.split(r"\s+", plain) if x]),
        "isPublished": 1,
        "is_published": 1,
        "createdAt": t,
        "created_at": t,
        "updatedAt": t,
        "updated_at": t,
    }
    sql, vals = make_insert_sql("chunks", c_data)
    cur.execute(sql, vals)

def load_json_file(path: Path):
    raw = path.read_text(encoding="utf-8", errors="ignore")
    data = json.loads(raw)
    if isinstance(data, list):
        return data
    return [data]

import_id = create_import_batch(IMPORT_DIR.name)
errors = []
imported = 0

json_files = sorted(list(IMPORT_DIR.glob("*.json")))
html_files = sorted(list(IMPORT_DIR.glob("*.html")) + list(IMPORT_DIR.glob("*.htm")))

json_files = [p for p in json_files if p.name.lower() not in {"manifest.json", "qc_report.json", "chunks.json", "questions.json", "flashcards.json"}]

for path in json_files:
    try:
        items = load_json_file(path)
        for idx, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                raise ValueError(f"{path.name} item {idx} is not an object")
            insert_question(item, import_id, path.name)
            imported += 1
    except Exception as e:
        errors.append(f"{path.name}: {e}")
        print(f"[FAIL][JSON] {path.name}: {e}")

for path in html_files:
    try:
        insert_chunk_from_html(path, import_id)
        imported += 1
    except Exception as e:
        errors.append(f"{path.name}: {e}")
        print(f"[FAIL][HTML] {path.name}: {e}")

complete_import_batch(import_id, imported, errors)
conn.commit()

print("")
print("Done.")
print(f"Imported: {imported}")
print(f"Errors: {len(errors)}")
if import_id:
    print(f"Import batch id: {import_id}")

if errors:
    print("")
    print("First errors:")
    for err in errors[:10]:
        print(f"- {err}")

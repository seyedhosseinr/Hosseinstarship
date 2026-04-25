//! edge-parser — Production streaming WASM parser for URO-OMEGA V3.
//!
//! Two input formats, auto-detected from first non-whitespace byte:
//!
//! | First byte | Mode      | Wire format                                   |
//! |------------|-----------|-----------------------------------------------|
//! | `{`        | JSONL     | One `ParsedRecord` JSON object per `\n` line  |
//! | `[`        | JsonArray | Streaming `[{…}, {…}, …]` — zero full-buffer  |
//! | other      | JSONL     | Fallback (treats any content as JSONL lines)   |
//!
//! MEMORY CONTRACT
//! ───────────────
//! • `ParserState` is heap-pinned via `Box::into_raw`; pointer survives JS frames.
//! • `line_buf` / `obj_buf` reuse capacity across chunks — no alloc churn.
//! • Records vec is drained every `parse_chunk()` call — near-zero steady-state.
//! • parse_errors capped at 100 entries.
//! • `destroy_parser()` MUST be called exactly once to free.

use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;
use serde::{Deserialize, Serialize};

// ─── Panic hook (stripped in release via LTO + dead-code elimination) ─────────

#[cfg(feature = "console_error_panic_hook")]
#[wasm_bindgen(start)]
pub fn setup_panic_hook() {
    console_error_panic_hook::set_once();
}

// ─── Record types ────────────────────────────────────────────────────────────
// These mirror the Drizzle schema columns so the worker can do a direct insert
// without any field-remapping step.

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedQuestion {
    pub external_key: String,
    #[serde(default)] pub chapter_no: Option<u16>,
    #[serde(default)] pub chapter_id: Option<String>,
    pub stem_html: String,
    #[serde(default)] pub stem_text: Option<String>,
    #[serde(default)] pub lead_in: Option<String>,
    #[serde(default)] pub explanation_html: Option<String>,
    #[serde(default)] pub educational_objective: Option<String>,
    #[serde(default)] pub why_correct: Option<String>,
    #[serde(default)] pub why_others_wrong_json: Option<serde_json::Value>,
    #[serde(default)] pub question_type: Option<String>,
    #[serde(default)] pub difficulty: Option<String>,
    #[serde(default)] pub subject: Option<String>,
    #[serde(default)] pub system: Option<String>,
    #[serde(default)] pub category: Option<String>,
    #[serde(default)] pub topic: Option<String>,
    #[serde(default)] pub tags: Option<Vec<String>>,
    #[serde(default)] pub correct_answer: Option<String>,
    #[serde(default)] pub options: Vec<ParsedOption>,
    #[serde(default)] pub source_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedOption {
    pub option_key: String,
    pub content_html: String,
    #[serde(default)] pub content_text: Option<String>,
    #[serde(default)] pub is_correct: bool,
    #[serde(default)] pub sort_order: u8,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFlashcard {
    #[serde(default)] pub external_key: Option<String>,
    #[serde(default)] pub chapter_no: Option<u16>,
    #[serde(default)] pub chapter_id: Option<String>,
    #[serde(default)] pub card_type: Option<String>,
    pub front_html: String,
    pub back_html: String,
    #[serde(default)] pub extra_html: Option<String>,
    #[serde(default)] pub cloze_text: Option<String>,
    #[serde(default)] pub educational_objective: Option<String>,
    #[serde(default)] pub tags: Option<Vec<String>>,
    #[serde(default)] pub deck: Option<String>,
    #[serde(default)] pub source_doc_id: Option<String>,
    #[serde(default)] pub source_frame_id: Option<String>,
    #[serde(default)] pub anchor_id: Option<String>,
    #[serde(default)] pub highlight_text: Option<String>,
    #[serde(default)] pub source_json: Option<serde_json::Value>,
}

/// Discriminated union matching the JSONL wire format.
/// `record_type` tag is snake_case; struct fields are camelCase.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "record_type", rename_all = "snake_case")]
pub enum ParsedRecord {
    Question(ParsedQuestion),
    Flashcard(ParsedFlashcard),
}

// ─── Parse mode state machine ────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
enum ParseMode {
    /// Haven't seen first meaningful byte yet.
    AutoDetect,
    /// One JSON object per newline.
    Jsonl,
    /// Streaming `[{…}, {…}]` — brace-depth tracker.
    JsonArray,
}

/// State for the JSON-array streaming parser.
/// Tracks brace depth and string context to find complete objects without
/// buffering the entire array.
#[derive(Debug)]
struct JsonArrayState {
    /// Current brace nesting: `{` = +1, `}` = -1. When it returns to 0 after
    /// being >0, we have a complete object in `obj_buf`.
    depth: i32,
    /// Inside a JSON string literal? Need this to ignore `{` / `}` inside strings.
    in_string: bool,
    /// Previous byte was `\` inside a string? Need this for `\"`.
    escape_next: bool,
    /// Have we found the opening `[`?
    array_started: bool,
    /// Have we found the closing `]`?
    array_ended: bool,
    /// Accumulator for the current JSON object bytes.
    obj_buf: Vec<u8>,
}

impl JsonArrayState {
    fn new() -> Self {
        Self {
            depth: 0,
            in_string: false,
            escape_next: false,
            array_started: false,
            array_ended: false,
            obj_buf: Vec::with_capacity(8192),
        }
    }
}

// ─── Parser state ────────────────────────────────────────────────────────────

/// Heap-allocated mutable state threaded through all calls via raw pointer.
pub struct ParserState {
    mode: ParseMode,
    /// JSONL mode: accumulates bytes for the current line.
    line_buf: Vec<u8>,
    /// JSON array mode state (lazily initialized).
    json_array: JsonArrayState,
    /// Records parsed in the current `parse_chunk` call. Drained on return.
    records: Vec<ParsedRecord>,
    /// Running total of records emitted.
    pub records_emitted: u64,
    /// Running total of bytes consumed.
    pub bytes_consumed: u64,
    /// Parse errors (capped at 100).
    pub parse_errors: Vec<String>,
    /// Whether BOM has been stripped (only matters for first chunk).
    bom_checked: bool,
}

impl ParserState {
    fn new() -> Self {
        Self {
            mode: ParseMode::AutoDetect,
            line_buf: Vec::with_capacity(4096),
            json_array: JsonArrayState::new(),
            records: Vec::with_capacity(256),
            records_emitted: 0,
            bytes_consumed: 0,
            parse_errors: Vec::new(),
            bom_checked: false,
        }
    }

    /// Attempt to parse a complete line (JSONL) from `self.line_buf`.
    fn parse_jsonl_line(&mut self) -> Option<ParsedRecord> {
        // Trim trailing CR for CRLF handling.
        let mut end = self.line_buf.len();
        if end > 0 && self.line_buf[end - 1] == b'\r' {
            end -= 1;
        }
        let slice = &self.line_buf[..end];

        // Skip blank lines and // comments.
        let trimmed = trim_ascii(slice);
        if trimmed.is_empty() || trimmed.starts_with(b"//") {
            return None;
        }

        match serde_json::from_slice::<ParsedRecord>(trimmed) {
            Ok(record) => Some(record),
            Err(e) => {
                self.push_error(format!(
                    "jsonl_err='{}' prefix='{}'",
                    e,
                    lossy_prefix(trimmed, 80)
                ));
                None
            }
        }
    }

    /// Attempt to parse a complete JSON object (JSON array mode) from obj_buf.
    fn parse_json_object(&mut self) -> Option<ParsedRecord> {
        let slice = &self.json_array.obj_buf;
        let trimmed = trim_ascii(slice);
        if trimmed.is_empty() {
            return None;
        }

        match serde_json::from_slice::<ParsedRecord>(trimmed) {
            Ok(record) => Some(record),
            Err(e) => {
                self.push_error(format!(
                    "json_obj_err='{}' prefix='{}'",
                    e,
                    lossy_prefix(trimmed, 80)
                ));
                None
            }
        }
    }

    fn push_error(&mut self, msg: String) {
        if self.parse_errors.len() < 100 {
            self.parse_errors.push(msg);
        }
    }

    /// Feed one byte in JSONL mode.
    #[inline(always)]
    fn feed_jsonl(&mut self, byte: u8) {
        if byte == b'\n' {
            if let Some(record) = self.parse_jsonl_line() {
                self.records.push(record);
                self.records_emitted += 1;
            }
            self.line_buf.clear();
        } else {
            self.line_buf.push(byte);
        }
    }

    /// Feed one byte in JSON array mode.
    ///
    /// State machine:
    ///   1. Before `[`: skip whitespace, detect `[`.
    ///   2. Between objects: skip whitespace and commas, detect `{` or `]`.
    ///   3. Inside object: track depth, handle strings, accumulate bytes.
    ///   4. When depth returns to 0: parse accumulated object.
    #[inline(always)]
    fn feed_json_array(&mut self, byte: u8) {
        let ja = &mut self.json_array;

        // Phase 1: looking for the opening `[`.
        if !ja.array_started {
            if byte == b'[' {
                ja.array_started = true;
            }
            // Skip any other byte (whitespace, BOM residue, etc.)
            return;
        }

        // If we already found `]`, ignore trailing bytes.
        if ja.array_ended {
            return;
        }

        // Phase 2/3: inside the array.
        if ja.depth == 0 {
            // Between objects — looking for `{` or `]`.
            match byte {
                b'{' => {
                    ja.depth = 1;
                    ja.in_string = false;
                    ja.escape_next = false;
                    ja.obj_buf.clear();
                    ja.obj_buf.push(byte);
                }
                b']' => {
                    ja.array_ended = true;
                }
                // Skip commas, whitespace, etc.
                _ => {}
            }
            return;
        }

        // Phase 3: inside a JSON object.
        ja.obj_buf.push(byte);

        if ja.in_string {
            if ja.escape_next {
                ja.escape_next = false;
            } else if byte == b'\\' {
                ja.escape_next = true;
            } else if byte == b'"' {
                ja.in_string = false;
            }
            return;
        }

        // Not inside a string.
        match byte {
            b'"' => {
                ja.in_string = true;
                ja.escape_next = false;
            }
            b'{' | b'[' => {
                ja.depth += 1;
            }
            b'}' | b']' => {
                ja.depth -= 1;
                if ja.depth == 0 {
                    // Complete object — parse it.
                    if let Some(record) = self.parse_json_object() {
                        self.records.push(record);
                        self.records_emitted += 1;
                    }
                    self.json_array.obj_buf.clear();
                }
            }
            _ => {}
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn trim_ascii(slice: &[u8]) -> &[u8] {
    let start = slice.iter().position(|b| !b.is_ascii_whitespace()).unwrap_or(slice.len());
    let end = slice.iter().rposition(|b| !b.is_ascii_whitespace()).map_or(start, |p| p + 1);
    &slice[start..end]
}

fn lossy_prefix(slice: &[u8], max: usize) -> String {
    let len = slice.len().min(max);
    String::from_utf8_lossy(&slice[..len]).into_owned()
}

/// Strip UTF-8 BOM (EF BB BF) from the start of a byte slice.
fn strip_bom(data: &[u8]) -> &[u8] {
    if data.len() >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
        &data[3..]
    } else {
        data
    }
}

/// Find the first non-whitespace byte to decide parse mode.
fn detect_mode(data: &[u8]) -> ParseMode {
    for &b in data {
        if b.is_ascii_whitespace() {
            continue;
        }
        return match b {
            b'[' => ParseMode::JsonArray,
            _ => ParseMode::Jsonl,
        };
    }
    // All whitespace — stay in auto-detect for the next chunk.
    ParseMode::AutoDetect
}

// ─── WASM exports ────────────────────────────────────────────────────────────

/// Allocate a new parser state. Returns a pointer (u32) for the JS caller.
#[wasm_bindgen]
pub fn init_parser() -> u32 {
    Box::into_raw(Box::new(ParserState::new())) as u32
}

/// Feed one chunk of the input stream to the parser.
///
/// Returns a JSON string: `"[{…}, {…}, …]"` (array of ParsedRecord).
/// Returns `"[]"` if no complete records were extracted from this chunk.
#[wasm_bindgen]
pub fn parse_chunk(state_ptr: u32, chunk: Uint8Array) -> Result<String, JsValue> {
    let state: &mut ParserState = unsafe { &mut *(state_ptr as *mut ParserState) };

    // Copy chunk bytes into Rust memory. This is a single memcpy (≤64 KiB).
    let mut bytes = chunk.to_vec();
    state.bytes_consumed += bytes.len() as u64;
    state.records.clear();

    // Strip BOM on first chunk only.
    let start = if !state.bom_checked {
        state.bom_checked = true;
        let stripped = strip_bom(&bytes);
        bytes.len() - stripped.len()
    } else {
        0
    };

    // Auto-detect mode on first meaningful bytes.
    if state.mode == ParseMode::AutoDetect {
        state.mode = detect_mode(&bytes[start..]);
        // If still auto-detect (all whitespace), bail.
        if state.mode == ParseMode::AutoDetect {
            return Ok("[]".to_owned());
        }
    }

    // Dispatch each byte to the active mode's state machine.
    match state.mode {
        ParseMode::Jsonl => {
            for &byte in &bytes[start..] {
                state.feed_jsonl(byte);
            }
        }
        ParseMode::JsonArray => {
            for &byte in &bytes[start..] {
                state.feed_json_array(byte);
            }
        }
        ParseMode::AutoDetect => unreachable!(),
    }

    serde_json::to_string(&state.records)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Flush any remaining partial data as the final record.
/// Call after the last `parse_chunk` when `isLast` is true.
#[wasm_bindgen]
pub fn flush_parser(state_ptr: u32) -> Result<String, JsValue> {
    let state: &mut ParserState = unsafe { &mut *(state_ptr as *mut ParserState) };
    state.records.clear();

    match state.mode {
        ParseMode::Jsonl => {
            // Flush incomplete line buffer (file missing trailing newline).
            if !state.line_buf.is_empty() {
                if let Some(record) = state.parse_jsonl_line() {
                    state.records.push(record);
                    state.records_emitted += 1;
                }
                state.line_buf.clear();
            }
        }
        ParseMode::JsonArray => {
            // If there's a partial object in the buffer, try to parse it.
            if !state.json_array.obj_buf.is_empty() && state.json_array.depth > 0 {
                state.push_error(format!(
                    "truncated_object: depth={} buf_len={}",
                    state.json_array.depth,
                    state.json_array.obj_buf.len()
                ));
            }
        }
        ParseMode::AutoDetect => {
            // Never got any data — nothing to flush.
        }
    }

    serde_json::to_string(&state.records)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Progress snapshot: `{"recordsEmitted":N, "bytesConsumed":N, "parseErrors":N}`
#[wasm_bindgen]
pub fn get_progress(state_ptr: u32) -> String {
    let state: &ParserState = unsafe { &*(state_ptr as *const ParserState) };
    format!(
        r#"{{"recordsEmitted":{},"bytesConsumed":{},"parseErrors":{}}}"#,
        state.records_emitted,
        state.bytes_consumed,
        state.parse_errors.len()
    )
}

/// Parse errors as JSON array of strings.
#[wasm_bindgen]
pub fn get_parse_errors(state_ptr: u32) -> String {
    let state: &ParserState = unsafe { &*(state_ptr as *const ParserState) };
    serde_json::to_string(&state.parse_errors).unwrap_or_else(|_| "[]".to_owned())
}

/// Free the parser state. MUST be called exactly once per `init_parser()`.
#[wasm_bindgen]
pub fn destroy_parser(state_ptr: u32) {
    let _state = unsafe { Box::from_raw(state_ptr as *mut ParserState) };
    // Drops all owned allocations.
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn roundtrip_jsonl(input: &str) -> Vec<ParsedRecord> {
        let ptr = init_parser();
        let bytes = input.as_bytes();
        let json = parse_chunk(ptr, Uint8Array::from(bytes)).unwrap();
        let mut records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
        let flush_json = flush_parser(ptr).unwrap();
        let flush_records: Vec<ParsedRecord> = serde_json::from_str(&flush_json).unwrap();
        records.extend(flush_records);
        destroy_parser(ptr);
        records
    }

    #[test]
    fn jsonl_single_question() {
        let input = r#"{"record_type":"question","externalKey":"q-001","stemHtml":"<p>What is X?</p>","options":[]}
"#;
        let records = roundtrip_jsonl(input);
        assert_eq!(records.len(), 1);
        match &records[0] {
            ParsedRecord::Question(q) => assert_eq!(q.external_key, "q-001"),
            _ => panic!("expected question"),
        }
    }

    #[test]
    fn jsonl_mixed_types() {
        let input = concat!(
            r#"{"record_type":"question","externalKey":"q1","stemHtml":"Q"}"#, "\n",
            r#"{"record_type":"flashcard","frontHtml":"F","backHtml":"B"}"#, "\n",
        );
        let records = roundtrip_jsonl(input);
        assert_eq!(records.len(), 2);
    }

    #[test]
    fn jsonl_missing_trailing_newline() {
        let input = r#"{"record_type":"question","externalKey":"q1","stemHtml":"<p>Q</p>","options":[]}"#;
        let records = roundtrip_jsonl(input);
        assert_eq!(records.len(), 1);
    }

    #[test]
    fn jsonl_crlf() {
        let input = concat!(
            r#"{"record_type":"question","externalKey":"q1","stemHtml":"Q"}"#, "\r\n",
            r#"{"record_type":"question","externalKey":"q2","stemHtml":"Q"}"#, "\r\n",
        );
        let records = roundtrip_jsonl(input);
        assert_eq!(records.len(), 2);
    }

    #[test]
    fn jsonl_skip_blank_and_comment() {
        let input = concat!(
            "// This is a comment\n",
            "\n",
            r#"{"record_type":"question","externalKey":"q1","stemHtml":"Q"}"#, "\n",
            "\n",
        );
        let records = roundtrip_jsonl(input);
        assert_eq!(records.len(), 1);
    }

    #[test]
    fn json_array_basic() {
        let input = r#"[
  {"record_type":"question","externalKey":"q1","stemHtml":"A","options":[]},
  {"record_type":"flashcard","frontHtml":"F","backHtml":"B"}
]"#;
        let ptr = init_parser();
        let json = parse_chunk(ptr, Uint8Array::from(input.as_bytes())).unwrap();
        let mut records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
        let flush_json = flush_parser(ptr).unwrap();
        let flush_records: Vec<ParsedRecord> = serde_json::from_str(&flush_json).unwrap();
        records.extend(flush_records);
        destroy_parser(ptr);
        assert_eq!(records.len(), 2);
    }

    #[test]
    fn json_array_nested_braces_in_strings() {
        let input = r#"[{"record_type":"question","externalKey":"q1","stemHtml":"<p>{test}</p>","options":[]}]"#;
        let ptr = init_parser();
        let json = parse_chunk(ptr, Uint8Array::from(input.as_bytes())).unwrap();
        let records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
        destroy_parser(ptr);
        assert_eq!(records.len(), 1);
    }

    #[test]
    fn chunk_boundary_reconstruction() {
        let full_line = r#"{"record_type":"question","externalKey":"q-split","stemHtml":"<p>Split across chunks</p>","options":[]}"#;
        let mid = full_line.len() / 2;
        let chunk1 = &full_line.as_bytes()[..mid];
        let chunk2_raw = format!("{}\n", &full_line[mid..]);
        let chunk2 = chunk2_raw.as_bytes();

        let ptr = init_parser();
        let json1 = parse_chunk(ptr, Uint8Array::from(chunk1)).unwrap();
        let r1: Vec<ParsedRecord> = serde_json::from_str(&json1).unwrap();
        assert!(r1.is_empty(), "no complete record in first half");

        let json2 = parse_chunk(ptr, Uint8Array::from(chunk2)).unwrap();
        let r2: Vec<ParsedRecord> = serde_json::from_str(&json2).unwrap();
        assert_eq!(r2.len(), 1, "record should complete in second half");

        destroy_parser(ptr);
    }

    #[test]
    fn bom_stripping() {
        let mut input = vec![0xEF, 0xBB, 0xBF]; // UTF-8 BOM
        input.extend_from_slice(br#"{"record_type":"question","externalKey":"q1","stemHtml":"Q"}"#);
        input.push(b'\n');

        let ptr = init_parser();
        let json = parse_chunk(ptr, Uint8Array::from(&input[..])).unwrap();
        let records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
        destroy_parser(ptr);
        assert_eq!(records.len(), 1);
    }

    #[test]
    fn destroy_does_not_leak() {
        let ptr = init_parser();
        destroy_parser(ptr);
    }

    #[test]
    fn parse_error_capped_at_100() {
        let ptr = init_parser();
        let bad_line = "NOT VALID JSON\n";
        for _ in 0..150 {
            let _ = parse_chunk(ptr, Uint8Array::from(bad_line.as_bytes()));
        }
        let errs_json = get_parse_errors(ptr);
        let errs: Vec<String> = serde_json::from_str(&errs_json).unwrap();
        assert_eq!(errs.len(), 100, "errors must be capped at 100");
        destroy_parser(ptr);
    }

    // ── Chunk boundary: JSON array mode ──────────────────────────────────────
    // An object in a JSON array is split across two chunks. The state machine
    // must hold partial bytes in obj_buf across the chunk boundary and only
    // emit the record when the closing `}` restores depth to 0.
    #[test]
    fn json_array_chunk_boundary() {
        let full =
            br#"[{"record_type":"question","externalKey":"q-array-split","stemHtml":"<p>Split</p>","options":[]}]"#;

        // Split inside the object, well before its closing `}`.
        // Position 40: `[{"record_type":"question","externalKey":`
        let split = 40;
        let chunk1 = &full[..split];
        let chunk2 = &full[split..];

        let ptr = init_parser();

        let json1 = parse_chunk(ptr, Uint8Array::from(chunk1)).unwrap();
        let r1: Vec<ParsedRecord> = serde_json::from_str(&json1).unwrap();
        assert!(r1.is_empty(), "no complete object yet — obj_buf must hold partial bytes");

        let json2 = parse_chunk(ptr, Uint8Array::from(chunk2)).unwrap();
        let mut r2: Vec<ParsedRecord> = serde_json::from_str(&json2).unwrap();
        let flush_json = flush_parser(ptr).unwrap();
        let flush_r: Vec<ParsedRecord> = serde_json::from_str(&flush_json).unwrap();
        r2.extend(flush_r);

        assert_eq!(r2.len(), 1, "object must be emitted after depth returns to 0");
        match &r2[0] {
            ParsedRecord::Question(q) => assert_eq!(q.external_key, "q-array-split"),
            _ => panic!("expected question"),
        }

        destroy_parser(ptr);
    }

    // ── Large record streaming (JSONL) ────────────────────────────────────────
    // A single JSONL record larger than a typical ReadableStream chunk (4 KiB).
    // The parser must grow line_buf across many chunk calls and reconstruct the
    // record correctly from the final newline.
    #[test]
    fn large_jsonl_record() {
        // 16 KiB stem — larger than the default ReadableStream chunk size.
        let large_html = "x".repeat(16_384);
        let line = format!(
            r#"{{"record_type":"question","externalKey":"q-large","stemHtml":"{}"}}"#,
            large_html
        );

        const CHUNK_SIZE: usize = 4096;
        let bytes = line.as_bytes();
        let ptr = init_parser();

        // Feed in 4 KiB chunks — no record should emit until the newline.
        let mut total_records = 0usize;
        let mut i = 0;
        while i < bytes.len() {
            let end = (i + CHUNK_SIZE).min(bytes.len());
            let json = parse_chunk(ptr, Uint8Array::from(&bytes[i..end])).unwrap();
            let records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
            total_records += records.len();
            i = end;
        }

        // The newline terminates the record.
        let json = parse_chunk(ptr, Uint8Array::from(b"\n".as_ref())).unwrap();
        let records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
        total_records += records.len();

        let flush_json = flush_parser(ptr).unwrap();
        let flush_r: Vec<ParsedRecord> = serde_json::from_str(&flush_json).unwrap();
        total_records += flush_r.len();

        destroy_parser(ptr);
        assert_eq!(total_records, 1, "large JSONL record must reconstruct from line_buf");
    }

    // ── Nested arrays inside an object (JSON array mode) ─────────────────────
    // The `options` field contains a JSON array. The depth tracker must not
    // treat the options `]` as the end of the outer object.
    #[test]
    fn json_array_nested_array_in_options() {
        let input = concat!(
            r#"[{"record_type":"question","externalKey":"q-opts","stemHtml":"<p>Q</p>","options":["#,
            r#"{"optionKey":"A","contentHtml":"<p>A</p>","isCorrect":false,"sortOrder":0},"#,
            r#"{"optionKey":"B","contentHtml":"<p>B</p>","isCorrect":true,"sortOrder":1}"#,
            r#"]}]"#,
        );
        let ptr = init_parser();
        let json = parse_chunk(ptr, Uint8Array::from(input.as_bytes())).unwrap();
        let records: Vec<ParsedRecord> = serde_json::from_str(&json).unwrap();
        destroy_parser(ptr);

        assert_eq!(records.len(), 1, "object must not close early on options `]`");
        match &records[0] {
            ParsedRecord::Question(q) => assert_eq!(q.options.len(), 2),
            _ => panic!("expected question"),
        }
    }
}

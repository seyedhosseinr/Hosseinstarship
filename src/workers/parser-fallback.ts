/**
 * parser-fallback.ts — Pure TypeScript streaming parser.
 *
 * Implements StreamParser with zero native or WASM dependencies.
 * Activated automatically by createParser() when WASM is unavailable.
 *
 * SUPPORTS
 * ─────────
 *   • JSONL (one JSON object per LF-terminated line)
 *   • JSON array ([{...}, {...}])
 *   • Chunk boundary reconstruction — records can span many chunks
 *   • UTF-8 BOM stripping (EF BB BF on first chunk)
 *   • CRLF and bare-LF line endings
 *   • Records larger than one chunk (large line_buf / obj_buf)
 *   • Nested arrays and objects inside records
 *   • // line comments (JSONL mode only)
 *
 * LIMITATIONS
 * ────────────
 *   • ~10× slower than the WASM backend for files > 5 MB
 *   • No JSON5 / NDJSON multi-line values
 *   • Does not validate UTF-8 strictness (TextDecoder fatal:false)
 *   • JSON array mode does not handle multi-line string values
 *     that contain raw newlines (valid in JSONL but rare in practice)
 */

import type { ParsedRecord, StreamParser } from "./parser-contract";

// ── Byte constants ────────────────────────────────────────────────────────────

const B_LF     = 0x0a; // \n
const B_CR     = 0x0d; // \r
const B_LBRACE = 0x7b; // {
const B_RBRACE = 0x7d; // }
const B_LBRACK = 0x5b; // [
const B_RBRACK = 0x5d; // ]
const B_QUOTE  = 0x22; // "
const B_BSLASH = 0x5c; // backslash
const B_SPACE  = 0x20;
const B_TAB    = 0x09;
const B_BOM0   = 0xef;
const B_BOM1   = 0xbb;
const B_BOM2   = 0xbf;

const ERROR_CAP = 100;

// TextDecoder is available in all modern browsers and Node ≥ 11.
// fatal:false replaces malformed byte sequences with U+FFFD rather than
// throwing, which is safer for a parser that must not crash on bad input.
const DECODER = new TextDecoder("utf-8", { fatal: false });

// ── Growable byte buffer ──────────────────────────────────────────────────────
// Avoids the `String.fromCharCode(...arr)` call-stack overflow for large
// records, and is more memory-efficient than a plain number[].

class ByteBuffer {
  private buf: Uint8Array;
  private _len = 0;

  constructor(initialCapacity = 4096) {
    this.buf = new Uint8Array(initialCapacity);
  }

  push(b: number): void {
    if (this._len === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this._len++] = b;
  }

  get(i: number): number {
    return this.buf[i];
  }

  get length(): number {
    return this._len;
  }

  /** Decode bytes [0, end) as UTF-8. Defaults to full length. */
  decode(end = this._len): string {
    return DECODER.decode(this.buf.subarray(0, end));
  }

  clear(): void {
    this._len = 0;
  }
}

// ── JsParser ──────────────────────────────────────────────────────────────────

export class JsParser implements StreamParser {
  // ── mode ─────────────────────────────────────────────────────────────────
  private mode: "auto" | "jsonl" | "json-array" = "auto";

  // ── JSONL state ───────────────────────────────────────────────────────────
  // Grows until a LF byte is seen, then parsed and cleared.
  private lineBuf = new ByteBuffer(4096);

  // ── JSON array state ──────────────────────────────────────────────────────
  // Brace-depth + string-context state machine. Mirrors the Rust implementation
  // in crates/edge-parser/src/lib.rs exactly so behaviour is consistent.
  private depth        = 0;
  private inString     = false;
  private escapeNext   = false;
  private arrayStarted = false;
  private arrayEnded   = false;
  private objBuf       = new ByteBuffer(8192);

  // ── Misc ──────────────────────────────────────────────────────────────────
  private bomChecked = false;
  private _bytesConsumed  = 0;
  private _recordsEmitted = 0;
  private _parseErrors: string[] = [];

  // ── StreamParser ──────────────────────────────────────────────────────────

  parseChunk(chunk: Uint8Array): ParsedRecord[] {
    const records: ParsedRecord[] = [];
    let bytes = chunk;

    // BOM stripping — first chunk only.
    if (!this.bomChecked) {
      this.bomChecked = true;
      if (bytes.length >= 3 && bytes[0] === B_BOM0 && bytes[1] === B_BOM1 && bytes[2] === B_BOM2) {
        bytes = bytes.subarray(3);
      }
    }

    this._bytesConsumed += chunk.byteLength;

    // Mode auto-detection from first non-whitespace byte.
    if (this.mode === "auto") {
      this.mode = this.detectMode(bytes);
      if (this.mode === "auto") return records; // all-whitespace chunk
    }

    if (this.mode === "jsonl") {
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === B_LF) {
          const rec = this.parseJsonlLine();
          if (rec !== null) {
            records.push(rec);
            this._recordsEmitted++;
          }
          this.lineBuf.clear();
        } else {
          this.lineBuf.push(b);
        }
      }
    } else {
      // json-array mode
      for (let i = 0; i < bytes.length; i++) {
        const rec = this.feedJsonArray(bytes[i]);
        if (rec !== null) {
          records.push(rec);
          this._recordsEmitted++;
        }
      }
    }

    return records;
  }

  flush(): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    if (this.mode === "jsonl" && this.lineBuf.length > 0) {
      // File without trailing newline — flush the last line.
      const rec = this.parseJsonlLine();
      if (rec !== null) {
        records.push(rec);
        this._recordsEmitted++;
      }
      this.lineBuf.clear();
    } else if (this.mode === "json-array" && this.objBuf.length > 0 && this.depth > 0) {
      // Truncated object — record as an error, do not attempt partial parse.
      this.pushError(`truncated_object: depth=${this.depth} buf_len=${this.objBuf.length}`);
    }

    return records;
  }

  destroy(): void {
    this.lineBuf.clear();
    this.objBuf.clear();
  }

  get bytesConsumed()  { return this._bytesConsumed; }
  get recordsEmitted() { return this._recordsEmitted; }
  get parseErrors()    { return this._parseErrors; }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private detectMode(bytes: Uint8Array): "jsonl" | "json-array" | "auto" {
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      // Skip ASCII whitespace.
      if (b === B_SPACE || b === B_TAB || b === B_LF || b === B_CR) continue;
      return b === B_LBRACK ? "json-array" : "jsonl";
    }
    return "auto"; // all-whitespace chunk, defer detection
  }

  private parseJsonlLine(): ParsedRecord | null {
    // Trim trailing CR (CRLF files).
    let end = this.lineBuf.length;
    while (end > 0 && this.lineBuf.get(end - 1) === B_CR) end--;
    if (end === 0) return null;

    const str = this.lineBuf.decode(end).trim();
    if (!str || str.startsWith("//")) return null; // blank or comment

    try {
      return JSON.parse(str) as ParsedRecord;
    } catch (e) {
      this.pushError(`jsonl_err='${e}' prefix='${str.slice(0, 80)}'`);
      return null;
    }
  }

  /**
   * Feed one byte through the JSON array state machine.
   *
   * States:
   *   Phase 1 — before `[`: skip everything, wait for opening bracket.
   *   Phase 2 — depth 0, inside array: skip whitespace/commas, detect `{` or `]`.
   *   Phase 3 — depth > 0, inside object: accumulate bytes, track depth.
   *             When depth returns to 0 after being > 0, emit the object.
   *
   * String tracking prevents `{` / `}` / `[` / `]` inside string values from
   * confusing the depth counter. Escape tracking prevents `\"` from closing
   * a string prematurely.
   */
  private feedJsonArray(b: number): ParsedRecord | null {
    // Phase 1: wait for the opening `[`.
    if (!this.arrayStarted) {
      if (b === B_LBRACK) this.arrayStarted = true;
      return null;
    }

    if (this.arrayEnded) return null;

    // Phase 2: between objects at depth 0.
    if (this.depth === 0) {
      if (b === B_LBRACE) {
        this.depth        = 1;
        this.inString     = false;
        this.escapeNext   = false;
        this.objBuf.clear();
        this.objBuf.push(b);
      } else if (b === B_RBRACK) {
        this.arrayEnded = true;
      }
      // Commas and whitespace are silently skipped.
      return null;
    }

    // Phase 3: inside an object — accumulate every byte.
    this.objBuf.push(b);

    // String context: forward bytes unchanged until closing quote.
    if (this.inString) {
      if (this.escapeNext) {
        this.escapeNext = false;
      } else if (b === B_BSLASH) {
        this.escapeNext = true;
      } else if (b === B_QUOTE) {
        this.inString = false;
      }
      return null;
    }

    // Not in a string — interpret structural characters.
    switch (b) {
      case B_QUOTE:
        this.inString   = true;
        this.escapeNext = false;
        break;

      case B_LBRACE:
      case B_LBRACK:
        this.depth++;
        break;

      case B_RBRACE:
      case B_RBRACK:
        this.depth--;
        if (this.depth === 0) {
          const rec = this.parseJsonObject();
          this.objBuf.clear();
          return rec;
        }
        break;
    }

    return null;
  }

  private parseJsonObject(): ParsedRecord | null {
    const str = this.objBuf.decode().trim();
    if (!str) return null;
    try {
      return JSON.parse(str) as ParsedRecord;
    } catch (e) {
      this.pushError(`json_obj_err='${e}' prefix='${str.slice(0, 80)}'`);
      return null;
    }
  }

  private pushError(msg: string): void {
    if (this._parseErrors.length < ERROR_CAP) {
      this._parseErrors.push(msg);
    }
  }
}

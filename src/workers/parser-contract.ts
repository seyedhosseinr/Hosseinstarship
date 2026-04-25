/**
 * parser-contract.ts — Narrow streaming parser interface.
 *
 * No caller imports the WASM module directly. Call createParser() once;
 * drive the returned StreamParser. If WASM is unavailable (not compiled,
 * browser lacks WebAssembly, or runtime error), createParser() silently
 * returns the pure-JS fallback. The caller never knows which backend ran.
 *
 * USAGE
 * ─────
 *   const { parser, backend } = await createParser();
 *   for (const chunk of stream) {
 *     const records = parser.parseChunk(chunk);
 *     // ... write records to DB
 *   }
 *   const trailing = parser.flush();
 *   parser.destroy();
 */

// ── Output types ──────────────────────────────────────────────────────────────
// Mirror the Rust structs in crates/edge-parser/src/lib.rs.
// Any field added in Rust must be added here too.

export interface ParsedOption {
  optionKey: string;
  contentHtml: string;
  contentText?: string | null;
  isCorrect: boolean;
  sortOrder: number;
}

export interface ParsedQuestion {
  record_type: "question";
  externalKey: string;
  chapterNo?: number | null;
  chapterId?: string | null;
  stemHtml: string;
  stemText?: string | null;
  leadIn?: string | null;
  explanationHtml?: string | null;
  educationalObjective?: string | null;
  whyCorrect?: string | null;
  questionType?: string | null;
  difficulty?: string | null;
  subject?: string | null;
  system?: string | null;
  category?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  correctAnswer?: string | null;
  options: ParsedOption[];
  sourceJson?: unknown;
}

export interface ParsedFlashcard {
  record_type: "flashcard";
  externalKey?: string | null;
  chapterNo?: number | null;
  chapterId?: string | null;
  cardType?: string | null;
  frontHtml: string;
  backHtml: string;
  extraHtml?: string | null;
  clozeText?: string | null;
  educationalObjective?: string | null;
  tags?: string[] | null;
  deck?: string | null;
  sourceDocId?: string | null;
  sourceFrameId?: string | null;
  anchorId?: string | null;
  highlightText?: string | null;
  sourceJson?: unknown;
}

export type ParsedRecord = ParsedQuestion | ParsedFlashcard;

// ── Parser contract ───────────────────────────────────────────────────────────

/**
 * One instance per import run. Stateful across calls.
 * Both the WASM backend and the JS fallback satisfy this interface.
 */
export interface StreamParser {
  /**
   * Feed one ReadableStream chunk.
   *
   * Returns zero or more complete records. Returns [] when the chunk ends
   * mid-record (JSONL line or JSON array object boundary) — the partial
   * bytes are retained internally and completed on the next call.
   *
   * Never throws. Parse errors are accumulated in parseErrors instead.
   */
  parseChunk(chunk: Uint8Array): ParsedRecord[];

  /**
   * Flush any buffered partial record after the last chunk.
   * Must be called once even when the stream ended on a clean boundary.
   */
  flush(): ParsedRecord[];

  /**
   * Release all internal state (Rust heap / JS buffers).
   * Must be called exactly once. No other method may be called after this.
   */
  destroy(): void;

  /** Running total bytes consumed across all parseChunk calls. */
  readonly bytesConsumed: number;

  /** Running total complete records emitted across parseChunk + flush. */
  readonly recordsEmitted: number;

  /**
   * Non-fatal parse errors (bad JSON lines, truncated objects, etc.).
   * Capped at 100. Parsing continues after any error.
   */
  readonly parseErrors: string[];
}

export type ParserBackend = "wasm" | "js-fallback";

export interface CreateParserResult {
  parser: StreamParser;
  /** Which backend is actually running — useful for diagnostics/logging. */
  backend: ParserBackend;
}

// ── WASM module shape ─────────────────────────────────────────────────────────
// Matches the wasm-bindgen generated exports from crates/edge-parser/src/lib.rs.
// parse_chunk / flush_parser return Result<String, JsValue> which becomes
// a throwing JS function — hence the plain `string` return type here.

interface WasmModule {
  init_parser(): number;
  parse_chunk(ptr: number, chunk: Uint8Array): string;
  flush_parser(ptr: number): string;
  get_parse_errors(ptr: number): string;
  destroy_parser(ptr: number): void;
}

// ── WASM adapter ──────────────────────────────────────────────────────────────

class WasmStreamParser implements StreamParser {
  private readonly wasm: WasmModule;
  private readonly ptr: number;
  private _bytesConsumed = 0;
  private _recordsEmitted = 0;
  private _parseErrors: string[] = [];

  constructor(wasm: WasmModule) {
    this.wasm = wasm;
    this.ptr = wasm.init_parser();
  }

  parseChunk(chunk: Uint8Array): ParsedRecord[] {
    try {
      const json = this.wasm.parse_chunk(this.ptr, chunk);
      const records = JSON.parse(json) as ParsedRecord[];
      this._bytesConsumed += chunk.byteLength;
      this._recordsEmitted += records.length;
      return records;
    } catch (e) {
      // parse_chunk returns Err only if serde_json::to_string fails (never in
      // practice), or if the WASM runtime itself traps. Treat as a soft error.
      this._parseErrors.push(`wasm_chunk_err: ${String(e)}`);
      this._bytesConsumed += chunk.byteLength;
      return [];
    }
  }

  flush(): ParsedRecord[] {
    try {
      const json = this.wasm.flush_parser(this.ptr);
      const records = JSON.parse(json) as ParsedRecord[];
      // Sync error list after flush — WASM accumulates errors internally.
      const errsJson = this.wasm.get_parse_errors(this.ptr);
      this._parseErrors = JSON.parse(errsJson) as string[];
      this._recordsEmitted += records.length;
      return records;
    } catch (e) {
      this._parseErrors.push(`wasm_flush_err: ${String(e)}`);
      return [];
    }
  }

  destroy(): void {
    this.wasm.destroy_parser(this.ptr);
  }

  get bytesConsumed() { return this._bytesConsumed; }
  get recordsEmitted() { return this._recordsEmitted; }
  get parseErrors() { return this._parseErrors; }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Load the optimal parser backend. Never rejects.
 *
 * Resolution:
 *   1. WASM   — requires `public/wasm/edge-parser/` artifact from wasm-pack
 *   2. JS     — pure TypeScript, always available, ~10× slower for large files
 *
 * Failure modes that silently fall back to JS:
 *   • WASM binary not found / fetch failed (artifact not compiled yet)
 *   • wasm-bindgen init() throws
 *   • typeof WebAssembly === "undefined" (very old browsers)
 *   • Any other runtime error during WASM load
 */
export async function createParser(): Promise<CreateParserResult> {
  if (typeof WebAssembly !== "undefined") {
    try {
      // Dynamic import keeps the WASM dependency out of non-worker bundles.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wasmMod = (await import("@/wasm/edge-parser")) as any;
      // wasm-pack bundler target emits a default-export init() function.
      if (typeof wasmMod.default === "function") {
        await (wasmMod.default as () => Promise<void>)();
      }
      const wasmResult: CreateParserResult = {
        parser: new WasmStreamParser(wasmMod as WasmModule),
        backend: "wasm",
      };
      console.info("[edge-parser] backend:", wasmResult.backend);
      return wasmResult;
    } catch {
      // Intentional silent fallback — do not surface WASM errors to the caller.
    }
  }

  const { JsParser } = await import("./parser-fallback");
  const jsResult: CreateParserResult = { parser: new JsParser(), backend: "js-fallback" };
  console.info("[edge-parser] backend:", jsResult.backend);
  return jsResult;
}

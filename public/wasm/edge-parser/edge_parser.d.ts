/* tslint:disable */
/* eslint-disable */

/**
 * Free the parser state. MUST be called exactly once per `init_parser()`.
 */
export function destroy_parser(state_ptr: number): void;

/**
 * Flush any remaining partial data as the final record.
 * Call after the last `parse_chunk` when `isLast` is true.
 */
export function flush_parser(state_ptr: number): string;

/**
 * Parse errors as JSON array of strings.
 */
export function get_parse_errors(state_ptr: number): string;

/**
 * Progress snapshot: `{"recordsEmitted":N, "bytesConsumed":N, "parseErrors":N}`
 */
export function get_progress(state_ptr: number): string;

/**
 * Allocate a new parser state. Returns a pointer (u32) for the JS caller.
 */
export function init_parser(): number;

/**
 * Feed one chunk of the input stream to the parser.
 *
 * Returns a JSON string: `"[{…}, {…}, …]"` (array of ParsedRecord).
 * Returns `"[]"` if no complete records were extracted from this chunk.
 */
export function parse_chunk(state_ptr: number, chunk: Uint8Array): string;

export function setup_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly destroy_parser: (a: number) => void;
    readonly flush_parser: (a: number, b: number) => void;
    readonly get_parse_errors: (a: number, b: number) => void;
    readonly get_progress: (a: number, b: number) => void;
    readonly init_parser: () => number;
    readonly parse_chunk: (a: number, b: number, c: number) => void;
    readonly setup_panic_hook: () => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

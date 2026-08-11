/**
 * Run-mode helpers retained for the Pigent host. Only the strict JSONL
 * framing utility is kept; TUI/print/RPC-client modes were pruned with the
 * standalone upstream product surface.
 */

export { attachJsonlLineReader, serializeJsonLine } from "./rpc/jsonl.ts";

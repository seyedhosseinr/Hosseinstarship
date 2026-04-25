/**
 * Ambient declaration for the `mermaid` package.
 *
 * The FrameMermaid component dynamically imports `mermaid` and falls back to
 * a <pre> source view on any failure, so the app compiles and runs correctly
 * whether or not `mermaid` is installed. This declaration lets TypeScript
 * accept `import("mermaid")` without requiring the real types.
 *
 * After `npm install mermaid`, the real types from node_modules take
 * precedence and this file becomes a no-op.
 */
declare module "mermaid" {
  interface MermaidRenderResult {
    svg: string;
    bindFunctions?: (element: Element) => void;
  }
  interface MermaidAPI {
    initialize(config: Record<string, unknown>): void;
    render(id: string, text: string): Promise<MermaidRenderResult>;
    parse(text: string): Promise<unknown> | unknown;
  }
  const mermaid: MermaidAPI;
  export default mermaid;
}

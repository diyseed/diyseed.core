// Minimal Node typings for the golden test; the project does not depend on @types/node.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: Uint8Array): void;
}
declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...parts: string[]): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
declare const process: { env: Record<string, string | undefined> };

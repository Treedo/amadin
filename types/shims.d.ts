declare var process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => never;
};

declare module 'fs' {
  export const promises: any;
  const fs: any;
  export default fs;
}

declare module 'path' {
  const path: any;
  export default path;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function resolve(...segments: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(path: string): string;
}

declare module 'child_process' {
  export function spawn(command: string, args?: string[], options?: any): any;
}

declare module 'crypto' {
  export function randomUUID(): string;
}

declare module 'fastify' {
  const fastify: any;
  export default fastify;
  export type FastifyInstance = any;
  export type FastifyPluginAsync = any;
  export type FastifyReply = any;
  export type FastifyRequest<T = any> = any;
  export type FastifyError = any;
}

declare module '@vitejs/plugin-react' {
  const plugin: any;
  export default plugin;
}

declare module 'vite' {
  export function defineConfig(config: any): any;
}

declare module 'commander' {
  export class Command {
    constructor(name?: string);
    description(desc: string): this;
    version(version: string): this;
    command(name: string): this;
    argument(name: string, description?: string, defaultValue?: string): this;
    option(flags: string, description?: string, defaultValue?: string): this;
    action(handler: (...args: any[]) => void): this;
    parse(argv: string[]): void;
  }
}

declare module 'react' {
  export const useState: any;
  export const useEffect: any;
  export const useMemo: any;
  export const useCallback: any;
  export const useContext: any;
  export const createContext: any;
  export const StrictMode: any;
  export type ReactNode = any;
  const React: any;
  export default React;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): any;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}

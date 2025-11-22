import type { SelectStatement } from './sqlAst.js';

type CustomQueryHook = (ast: SelectStatement) => SelectStatement;

export class CustomQueryRegistry {
  private readonly hooks = new Map<string, CustomQueryHook>();

  register(listCode: string, hook: CustomQueryHook): void {
    this.hooks.set(listCode, hook);
  }

  apply(listCode: string, ast: SelectStatement): SelectStatement {
    const hook = this.hooks.get(listCode);
    return hook ? hook(ast) : ast;
  }
}

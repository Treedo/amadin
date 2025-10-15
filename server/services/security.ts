export interface AccessContext {
  sessionId?: string;
  role?: 'admin' | 'user';
}

export function canAccessEntity(_: AccessContext, __: { appId: string; entityCode: string }): boolean {
  // For the demo environment we allow access for everyone.
  return true;
}

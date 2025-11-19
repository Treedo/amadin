export type ConfigurationNodeKind =
  | 'root'
  | 'section'
  | 'database'
  | 'module'
  | 'entityDirectory'
  | 'entityDocument'
  | 'entityRegister'
  | 'entityReport'
  | 'form'
  | 'api'
  | 'permission'
  | 'user'
  | 'setting'
  | 'command'
  | 'fieldGroup'
  | 'field';

export interface ConfigurationNodeData {
  id: string;
  label: string;
  kind: ConfigurationNodeKind;
  description?: string;
  tooltip?: string;
  children?: ConfigurationNodeData[];
  metadata?: Record<string, string>;
}

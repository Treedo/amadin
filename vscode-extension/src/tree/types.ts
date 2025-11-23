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
  formModel?: AmadinFormModel;
  formSource?: string;
}

export interface AmadinFormModel {
  id: string;
  name: string;
  layout: FormLayoutNode[];
  meta?: Record<string, string>;
}

export type FormLayoutNode =
  | FormGroupNode
  | FormFieldNode
  | FormTableNode
  | FormTabContainerNode;

export interface FormGroupNode {
  id: string;
  type: 'group';
  title: string;
  direction: 'horizontal' | 'vertical';
  children: FormLayoutNode[];
}

export interface FormFieldNode {
  id: string;
  type: 'field';
  label: string;
  fieldCode: string;
}

export interface FormTableNode {
  id: string;
  type: 'table';
  title: string;
  columns: Array<{ id: string; label: string; fieldCode: string }>;
}

export interface FormTabContainerNode {
  id: string;
  type: 'tabs';
  tabs: Array<{
    id: string;
    title: string;
    children: FormLayoutNode[];
  }>;
}

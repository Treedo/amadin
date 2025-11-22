import { ConfigurationNodeData } from './types';

export function buildSampleConfigurationTree(): ConfigurationNodeData {
  return {
    id: 'amadin-root',
    label: 'AMADIN CONFIGURATION',
    kind: 'root',
    children: [
      buildDatabasesSection(),
      buildCoreSection(),
      buildCliSection()
    ]
  };
}

function buildDatabasesSection(): ConfigurationNodeData {
  return {
    id: 'amadin-databases',
    label: 'Databases',
    kind: 'section',
    children: [
      buildDemoDatabase(),
      {
        id: 'amadin-database-prod',
        label: 'prod',
        kind: 'database',
        children: [
          {
            id: 'amadin-database-prod-placeholder',
            label: '…',
            kind: 'section',
            tooltip: 'Production configuration to be imported.'
          }
        ]
      }
    ]
  };
}

function buildDemoDatabase(): ConfigurationNodeData {
  return {
    id: 'amadin-database-demo',
    label: 'demo',
    kind: 'database',
    description: 'DatabaseConfig',
    children: [
      buildDemoModulesSection(),
      buildDemoUsersSection(),
      buildDemoSettingsSection()
    ]
  };
}

function buildDemoModulesSection(): ConfigurationNodeData {
  return {
    id: 'amadin-database-demo-modules',
    label: 'Modules',
    kind: 'section',
    children: [
      buildSalesModule(),
      buildInventoryModule()
    ]
  };
}

function buildSalesModule(): ConfigurationNodeData {
  return {
    id: 'amadin-module-sales',
    label: 'Sales',
    kind: 'module',
    children: [
      buildSalesEntities(),
      buildSalesForms(),
      buildSalesApi(),
      buildSalesPermissions()
    ]
  };
}

function buildSalesEntities(): ConfigurationNodeData {
  return {
    id: 'amadin-module-sales-entities',
    label: 'Entities',
    kind: 'section',
    children: [
      {
        id: 'amadin-entity-customer',
        label: 'Customer',
        kind: 'entityDirectory',
        description: 'Directory',
        children: [
          buildFieldsGroup('amadin-entity-customer-fields', [
            fieldNode('amadin-field-customer-id', 'id', 'uuid'),
            fieldNode('amadin-field-customer-name', 'name', 'string'),
            fieldNode('amadin-field-customer-email', 'email', 'string')
          ]),
          buildFormsGroup('amadin-entity-customer-forms', [
            formNode('amadin-entity-customer-card', 'Customer Card', 'Main directory form'),
            formNode('amadin-entity-customer-quick', 'Quick Edit', 'Compact inline editor')
          ])
        ]
      },
      {
        id: 'amadin-entity-order',
        label: 'Order',
        kind: 'entityDocument',
        description: 'Document',
        children: [
          buildFieldsGroup('amadin-entity-order-fields', [
            fieldNode('amadin-field-order-id', 'id', 'uuid'),
            fieldNode('amadin-field-order-date', 'date', 'date'),
            fieldNode('amadin-field-order-customer', 'customer', 'ref(Customer)'),
            fieldNode('amadin-field-order-total', 'total', 'float')
          ]),
          buildFormsGroup('amadin-entity-order-forms', [
            formNode('amadin-entity-order-entry', 'Order Entry', 'Primary document form'),
            formNode('amadin-entity-order-picking', 'Picking Sheet', 'Warehouse picking UI')
          ])
        ]
      },
      {
        id: 'amadin-entity-sales-register',
        label: 'SalesRegister',
        kind: 'entityRegister'
      },
      {
        id: 'amadin-entity-sales-report',
        label: 'SalesByCustomer',
        kind: 'entityReport'
      }
    ]
  };
}

function buildSalesApi(): ConfigurationNodeData {
  return {
    id: 'amadin-module-sales-api',
    label: 'API',
    kind: 'section',
    children: [
      {
        id: 'amadin-api-sales-orders',
        label: '/sales/orders',
        kind: 'api'
      }
    ]
  };
}

function buildSalesPermissions(): ConfigurationNodeData {
  return {
    id: 'amadin-module-sales-permissions',
    label: 'Permissions',
    kind: 'section',
    children: [
      {
        id: 'amadin-permission-view-order',
        label: 'view_order',
        kind: 'permission'
      },
      {
        id: 'amadin-permission-edit-order',
        label: 'edit_order',
        kind: 'permission'
      }
    ]
  };
}

function buildSalesForms(): ConfigurationNodeData {
  return {
    id: 'amadin-module-sales-forms',
    label: 'Forms',
    kind: 'section',
    children: [
      formNode('amadin-form-sales-dashboard', 'Sales Dashboard', 'Cross-entity analytics'),
      formNode('amadin-form-sales-forecast', 'Sales Forecast', 'Scenario planning workspace')
    ]
  };
}

function buildInventoryModule(): ConfigurationNodeData {
  return {
    id: 'amadin-module-inventory',
    label: 'Inventory',
    kind: 'module',
    children: [
      {
        id: 'amadin-module-inventory-entities',
        label: 'Entities',
        kind: 'section',
        children: [
          {
            id: 'amadin-entity-product',
            label: 'Product',
            kind: 'entityDirectory',
            description: 'Directory',
            children: [
              buildFormsGroup('amadin-entity-product-forms', [
                formNode('amadin-entity-product-card', 'Product Card', 'Comprehensive product form')
              ])
            ]
          }
        ]
      },
      buildInventoryForms()
    ]
  };
}

function buildInventoryForms(): ConfigurationNodeData {
  return {
    id: 'amadin-module-inventory-forms',
    label: 'Forms',
    kind: 'section',
    children: [
      formNode('amadin-form-stock-balance', 'Stock Balance', 'Global stock snapshot')
    ]
  };
}

function buildDemoUsersSection(): ConfigurationNodeData {
  return {
    id: 'amadin-database-demo-users',
    label: 'Users',
    kind: 'section',
    children: [
      {
        id: 'amadin-user-admin',
        label: 'admin',
        kind: 'user'
      },
      {
        id: 'amadin-user-viewer',
        label: 'viewer',
        kind: 'user'
      }
    ]
  };
}

function buildDemoSettingsSection(): ConfigurationNodeData {
  return {
    id: 'amadin-database-demo-settings',
    label: 'Settings',
    kind: 'section',
    children: [
      {
        id: 'amadin-setting-database-url',
        label: 'Database URL',
        kind: 'setting'
      }
    ]
  };
}

function buildCoreSection(): ConfigurationNodeData {
  return {
    id: 'amadin-core',
    label: 'Core',
    kind: 'section',
    children: [
      {
        id: 'amadin-core-modules',
        label: 'Modules',
        kind: 'section',
        children: [
          {
            id: 'amadin-core-module-system',
            label: 'System',
            kind: 'module'
          },
          {
            id: 'amadin-core-module-security',
            label: 'Security',
            kind: 'module'
          },
          {
            id: 'amadin-core-module-metadata',
            label: 'Metadata',
            kind: 'module'
          }
        ]
      },
      {
        id: 'amadin-core-entity-templates',
        label: 'Entity Templates',
        kind: 'section'
      },
      {
        id: 'amadin-core-base-types',
        label: 'Base Types',
        kind: 'section'
      }
    ]
  };
}

function buildCliSection(): ConfigurationNodeData {
  return {
    id: 'amadin-cli',
    label: 'CLI / Tools',
    kind: 'section',
    children: [
      commandNode('amadin-cli-init', 'amadin init'),
      commandNode('amadin-cli-generate', 'amadin generate'),
      commandNode('amadin-cli-migrate', 'amadin migrate')
    ]
  };
}

function buildFieldsGroup(id: string, fields: ConfigurationNodeData[]): ConfigurationNodeData {
  return {
    id,
    label: 'Fields',
    kind: 'fieldGroup',
    children: fields
  };
}

function buildFormsGroup(id: string, forms: ConfigurationNodeData[]): ConfigurationNodeData {
  return {
    id,
    label: 'Forms',
    kind: 'section',
    children: forms
  };
}

function fieldNode(id: string, name: string, type: string): ConfigurationNodeData {
  return {
    id,
    label: name,
    kind: 'field',
    description: type
  };
}

function formNode(id: string, name: string, description?: string): ConfigurationNodeData {
  return {
    id,
    label: name,
    kind: 'form',
    description
  };
}

function commandNode(id: string, label: string): ConfigurationNodeData {
  return {
    id,
    label,
    kind: 'command'
  };
}

import { MouseEvent, useEffect, useMemo, useState } from 'react';

import type { AppManifest, UiForm, UiFormGroupItem } from '../api/index.js';
import { fetchEntityRecord } from '../api/index.js';
import { useWindowManager } from '../context/WindowManagerContext.js';
import { TableView } from './TableView.js';

interface FormRendererProps {
  app: AppManifest;
  formCode?: string;
  recordId?: string;
}

export function FormRenderer({ app, formCode, recordId }: FormRendererProps) {
  const { openView } = useWindowManager();
  const activeForm = useMemo<UiForm | undefined>(() => {
    if (formCode) {
      return app.manifest.find((form) => form.code === formCode);
    }
    const preferred = app.manifest.find((form) => form.code === 'overview');
    return preferred ?? app.manifest[0];
  }, [app.manifest, formCode]);

  if (!activeForm) {
    return <p>Жодної форми не знайдено 🤷‍♀️</p>;
  }

  const primaryEntity = activeForm.primaryEntity ?? '';
  const isListForm = Boolean(activeForm.usage?.some((usage) => usage.role === 'list'));
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  useEffect(() => {
    if (isListForm) {
      setRecord(null);
      setRecordError(null);
      setRecordLoading(false);
      return;
    }

    if (!primaryEntity || !recordId) {
      setRecord(null);
      setRecordError(null);
      setRecordLoading(false);
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    setRecordError(null);
    fetchEntityRecord(primaryEntity, recordId)
      .then((fetched) => {
        if (!cancelled) {
          setRecord(fetched);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load record', error);
          setRecord(null);
          setRecordError('Не вдалося завантажити запис.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRecordLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isListForm, primaryEntity, recordId]);

  const handleLinkClick = (event: MouseEvent, item: Extract<UiFormGroupItem, { kind: 'link' }>) => {
    event.preventDefault();
    const newWindow = isAdditionalWindow(event);
    if (item.targetType === 'entity') {
      const [, entityCode = item.target] = item.target.split(':');
      const defaultListForm = app.defaults.entities[entityCode]?.list.formCode;
      if (defaultListForm) {
        openView({ kind: 'form', formCode: defaultListForm }, { newWindow, title: item.label });
        return;
      }
      openView({ kind: 'entity', entityCode }, { newWindow, title: item.label });
      return;
    }
    if (item.targetType === 'form') {
      const [, formCodeFromLink = item.target] = item.target.split(':');
      openView({ kind: 'form', formCode: formCodeFromLink }, { newWindow, title: item.label });
      return;
    }

    const targetUrl = resolveLinkHref(item);
    if (newWindow) {
      window.open(targetUrl, '_blank', 'noopener');
    } else {
      window.location.href = targetUrl;
    }
  };

  return (
    <section>
      <header>
        <h2>{activeForm.name}</h2>
      </header>
      {isListForm ? (
        primaryEntity ? (
          <TableView entityCode={primaryEntity} />
        ) : (
          <p style={{ color: '#6b7280' }}>Ця форма не має повʼязаної сутності для відображення списку.</p>
        )
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {recordId ? (
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>ID запису: {recordId}</div>
          ) : null}
          {recordLoading && <div>Завантаження даних…</div>}
          {recordError && <div style={{ color: '#c0392b' }}>{recordError}</div>}
          {activeForm.groups.map((group) => (
            <section
              key={group.code}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '1rem',
                padding: '1rem 1.5rem',
                background: group.color === 'accent' ? '#f5f3ff' : '#fff',
                display: 'grid',
                gap: '1rem'
              }}
            >
              <header>
                <h3 style={{ margin: 0 }}>{group.title}</h3>
              </header>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: group.orientation === 'horizontal' ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr',
                  gap: '1rem'
                }}
              >
                {group.items.map((item: UiFormGroupItem, index: number) => {
                  if (item.kind === 'field') {
                    const value = record ? record[item.field] : undefined;
                    return (
                      <label
                        key={`${group.code}-${item.field}-${index}`}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                      >
                        <span>
                          {item.label}
                          {item.required ? ' *' : ''}
                        </span>
                        {item.widget === 'textarea' ? (
                          <textarea
                            placeholder={item.field}
                            value={formatFieldValue(value)}
                            readOnly
                            style={{ background: '#f9fafb', minHeight: '4rem', resize: 'vertical' }}
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder={item.field}
                            value={formatFieldValue(value)}
                            readOnly
                            style={{ background: '#f9fafb' }}
                          />
                        )}
                      </label>
                    );
                  }

                  return (
                    <button
                      key={`${group.code}-${item.label}-${index}`}
                      type="button"
                      onClick={(event) => handleLinkClick(event, item)}
                      onAuxClick={(event) => handleLinkClick(event, item)}
                      style={{
                        display: 'block',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.75rem',
                        background: '#f9fafb',
                        textAlign: 'left',
                        color: '#1f2937',
                        cursor: 'pointer'
                      }}
                    >
                      <strong>{item.label}</strong>
                      {item.description ? <p style={{ margin: '0.25rem 0 0 0' }}>{item.description}</p> : null}
                      <small style={{ color: '#6b7280' }}>{resolveLinkHref(item)}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function resolveLinkHref(item: Extract<UiFormGroupItem, { kind: 'link' }>): string {
  if (item.targetType === 'entity') {
    const [, entityCode = item.target] = item.target.split(':');
    return `/entities/${entityCode}`;
  }
  if (item.targetType === 'form') {
    const [, formCode = item.target] = item.target.split(':');
    return `/forms/${formCode}`;
  }
  return item.target;
}

function isAdditionalWindow(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

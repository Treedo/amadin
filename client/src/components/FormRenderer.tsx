import { ChangeEvent, FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react';

import type { AppManifest, UiForm, UiFormGroupItem } from '../api/index.js';
import { createEntityRecord, fetchEntityRecord, updateEntityRecord } from '../api/index.js';
import { useWindowManager } from '../context/WindowManagerContext.js';
import { TableView } from './TableView.js';

interface FormRendererProps {
  app: AppManifest;
  formCode?: string;
  recordId?: string;
}

type FieldItem = Extract<UiFormGroupItem, { kind: 'field' }>;

type RecordData = Record<string, unknown>;

type FormValues = Record<string, string>;

export function FormRenderer({ app, formCode, recordId }: FormRendererProps) {
  const { openView, activeWindow, replaceView } = useWindowManager();
  const activeForm = useMemo<UiForm | undefined>(() => {
    if (formCode) {
      return app.manifest.find((form) => form.code === formCode);
    }
    const preferred = app.manifest.find((form) => form.code === 'overview');
    return preferred ?? app.manifest[0];
  }, [app.manifest, formCode]);

  const fieldItems = useMemo<FieldItem[]>(() => (activeForm ? extractFieldItems(activeForm) : []), [activeForm]);

  if (!activeForm) {
    return <p>Жодної форми не знайдено 🤷‍♀️</p>;
  }

  const primaryEntity = activeForm.primaryEntity ?? '';
  const isListForm = Boolean(activeForm.usage?.some((usage) => usage.role === 'list'));
  const itemFormCode = primaryEntity ? app.defaults.entities[primaryEntity]?.item.formCode : undefined;
  const itemFormName = useMemo(() => {
    if (!itemFormCode) {
      return undefined;
    }
    const form = app.manifest.find((candidate) => candidate.code === itemFormCode);
    return form?.name;
  }, [app.manifest, itemFormCode]);

  const [record, setRecord] = useState<RecordData | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isListForm) {
      setRecord(null);
      setRecordLoading(false);
      setRecordError(null);
      setFormValues({});
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);

    if (!primaryEntity) {
      setRecord(null);
      setRecordLoading(false);
      setRecordError('Ця форма не має сутності для відображення.');
      setFormValues(buildInitialValues(fieldItems, null));
      return;
    }

    if (!recordId) {
      setRecord(null);
      setRecordLoading(false);
      setRecordError(null);
      setFormValues(buildInitialValues(fieldItems, null));
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    setRecordError(null);

    fetchEntityRecord(primaryEntity, recordId)
      .then((fetched) => {
        if (!cancelled) {
          setRecord(fetched);
          setFormValues(buildInitialValues(fieldItems, fetched));
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
  }, [fieldItems, isListForm, primaryEntity, recordId]);

  const handleFieldChange = (
    fieldCode: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setFormValues((previous) => ({ ...previous, [fieldCode]: value }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!primaryEntity) {
      setSaveError('Форма не має сутності для збереження.');
      return;
    }

    const missingRequired = fieldItems.filter((item) => {
      const value = formValues[item.field];
      return item.required && (!value || !value.trim());
    });

    if (missingRequired.length > 0) {
      setSaveError('Будь ласка, заповніть усі обовʼязкові поля.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const payload = buildPayload(fieldItems, formValues);

    try {
      const nextRecord = recordId
        ? await updateEntityRecord(primaryEntity, recordId, payload)
        : await createEntityRecord(primaryEntity, payload);

      setRecord(nextRecord);
      setFormValues(buildInitialValues(fieldItems, nextRecord));
      setSaveSuccess('Збережено успішно.');

      if (!recordId && nextRecord && typeof nextRecord === 'object' && 'id' in nextRecord) {
        const idValue = String((nextRecord as RecordData).id ?? '');
        if (idValue && activeWindow?.view.kind === 'form') {
          replaceView(activeWindow.id, {
            kind: 'form',
            formCode: activeWindow.view.formCode,
            recordId: idValue
          });
        }
      }
    } catch (error) {
      console.error('Failed to save record', error);
      setSaveError(error instanceof Error ? error.message : 'Не вдалося зберегти форму.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewRecord = (event: MouseEvent<HTMLButtonElement>) => {
    if (!primaryEntity || !itemFormCode) {
      console.warn('Cannot open creation form without entity defaults.');
      return;
    }
    const newWindow = isAdditionalWindow(event);
    const title = itemFormName ? `${itemFormName} — новий запис` : 'Новий запис';
    openView({ kind: 'form', formCode: itemFormCode }, { newWindow, title });
  };

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
      const [, targetFormCode = item.target] = item.target.split(':');
      openView({ kind: 'form', formCode: targetFormCode }, { newWindow, title: item.label });
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
          <div style={{ display: 'grid', gap: '1rem' }}>
            {itemFormCode ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCreateNewRecord}
                  onAuxClick={handleCreateNewRecord}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #2563eb',
                    background: '#2563eb',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
                  <span>Створити</span>
                </button>
              </div>
            ) : null}
            <TableView entityCode={primaryEntity} />
          </div>
        ) : (
          <p style={{ color: '#6b7280' }}>Ця форма не має повʼязаної сутності для відображення списку.</p>
        )
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          {recordId ? (
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>ID запису: {recordId}</div>
          ) : null}
          {recordLoading && <div>Завантаження даних…</div>}
          {recordError && <div style={{ color: '#c0392b' }}>{recordError}</div>}
          {saveError && <div style={{ color: '#c0392b' }}>{saveError}</div>}
          {saveSuccess && <div style={{ color: '#16a34a' }}>{saveSuccess}</div>}

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
                  gridTemplateColumns: group.orientation === 'horizontal'
                    ? 'repeat(auto-fit, minmax(180px, 1fr))'
                    : '1fr',
                  gap: '1rem'
                }}
              >
                {group.items.map((item: UiFormGroupItem, index: number) => {
                  if (item.kind === 'field') {
                    const value = formValues[item.field] ?? '';
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
                            value={value}
                            onChange={(event) => handleFieldChange(item.field, event)}
                            style={{ minHeight: '4rem', resize: 'vertical' }}
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder={item.field}
                            value={value}
                            onChange={(event) => handleFieldChange(item.field, event)}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={!primaryEntity || saving || recordLoading}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: saving ? '#9ca3af' : '#2563eb',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function extractFieldItems(form: UiForm): FieldItem[] {
  const items: FieldItem[] = [];
  for (const group of form.groups) {
    for (const item of group.items) {
      if (isFieldItem(item)) {
        items.push(item);
      }
    }
  }
  return items;
}

function buildInitialValues(fields: FieldItem[], record: RecordData | null): FormValues {
  const initial: FormValues = {};
  for (const field of fields) {
    const value = record ? (record as Record<string, unknown>)[field.field] : undefined;
    initial[field.field] = coerceValueToString(value);
  }
  return initial;
}

function buildPayload(fields: FieldItem[], values: FormValues): RecordData {
  const payload: RecordData = {};
  for (const field of fields) {
    const value = values[field.field];
    payload[field.field] = value === '' ? null : value;
  }
  return payload;
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

function coerceValueToString(value: unknown): string {
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
      return '';
    }
  }
  return String(value);
}

function isFieldItem(item: UiFormGroupItem): item is FieldItem {
  return item.kind === 'field';
}

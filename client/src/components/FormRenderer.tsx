import { ChangeEvent, FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react';

import type { AppManifest, UiForm, UiFormGroupItem } from '../api/index.js';
import { createEntityRecord, fetchEntityRecord, fetchEntityRows, updateEntityRecord } from '../api/index.js';
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

type ReferenceOption = {
  value: string;
  label: string;
};

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
  const referenceFields = useMemo(() => fieldItems.filter((item) => Boolean(item.reference)), [fieldItems]);

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
  const [referenceOptions, setReferenceOptions] = useState<Record<string, ReferenceOption[]>>({});
  const [referenceLoading, setReferenceLoading] = useState<Record<string, boolean>>({});
  const [referenceErrors, setReferenceErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!referenceFields.length) {
      setReferenceOptions({});
      setReferenceLoading({});
      setReferenceErrors({});
      return;
    }

    let cancelled = false;

    const loadOptions = async () => {
      const loadingState: Record<string, boolean> = {};
      referenceFields.forEach((field) => {
        loadingState[field.field] = true;
      });
      setReferenceLoading(loadingState);

      const nextOptions: Record<string, ReferenceOption[]> = {};
      const nextErrors: Record<string, string> = {};

      for (const field of referenceFields) {
        const reference = field.reference;
        if (!reference) {
          nextOptions[field.field] = [];
          continue;
        }

        try {
          const rows = await fetchEntityRows(reference.entity);
          nextOptions[field.field] = buildReferenceOptions(rows, reference.labelField);
        } catch (error) {
          console.error(`Failed to load options for ${field.field}`, error);
          nextErrors[field.field] = 'Не вдалося завантажити варіанти.';
          nextOptions[field.field] = [];
        }
      }

      if (cancelled) {
        return;
      }

      setReferenceOptions(nextOptions);
      setReferenceErrors(nextErrors);
      const clearedLoading: Record<string, boolean> = {};
      referenceFields.forEach((field) => {
        clearedLoading[field.field] = false;
      });
      setReferenceLoading(clearedLoading);
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [referenceFields]);

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
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
                    const options = referenceOptions[item.field] ?? [];
                    const loadingOptions = Boolean(referenceLoading[item.field]);
                    const errorMessage = referenceErrors[item.field];
                    const needsFallbackOption = Boolean(
                      value && !options.some((option) => option.value === value)
                    );
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
                        ) : item.widget === 'select' || item.reference ? (
                          <select
                            value={value}
                            onChange={(event) => handleFieldChange(item.field, event)}
                            disabled={loadingOptions}
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                          >
                            <option value="">Не обрано</option>
                            {needsFallbackOption ? <option value={value}>{value}</option> : null}
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder={item.field}
                            value={value}
                            onChange={(event) => handleFieldChange(item.field, event)}
                          />
                        )}
                        {item.widget === 'select' || item.reference
                          ? (() => {
                              const helperText = errorMessage
                                ? errorMessage
                                : loadingOptions
                                  ? 'Завантаження варіантів…'
                                  : options.length
                                    ? 'Виберіть значення зі списку.'
                                    : '';
                              return helperText ? (
                                <span style={{ fontSize: '0.8rem', color: errorMessage ? '#c0392b' : '#6b7280' }}>
                                  {helperText}
                                </span>
                              ) : null;
                            })()
                          : null}
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

function buildReferenceOptions(rows: unknown[], labelField?: string): ReferenceOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const options: ReferenceOption[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!isRecordValue(row)) {
      continue;
    }
    const record = row as Record<string, unknown>;
    const identifier = record.id ?? record['ID'] ?? record.code;
    if (typeof identifier !== 'string' && typeof identifier !== 'number') {
      continue;
    }
    const value = String(identifier);
    if (seen.has(value)) {
      continue;
    }
    const label = resolveReferenceLabel(record, labelField) ?? value;
    options.push({ value, label });
    seen.add(value);
  }

  return options;
}

function resolveReferenceLabel(record: Record<string, unknown>, labelField?: string): string | undefined {
  if (labelField) {
    const candidate = record[labelField];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  const preferredKeys = ['name', 'title', 'code', 'number'];
  for (const key of preferredKeys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return undefined;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

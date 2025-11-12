import { ChangeEvent, FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AppManifest, UiForm, UiFormGroupItem } from '../api/index.js';
import type { ReferenceOption } from '../api/index.js';
import { createEntityRecord, fetchEntityRecord, searchEntityReference, updateEntityRecord } from '../api/index.js';
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
  const referenceFields = useMemo(() => fieldItems.filter((item) => Boolean(item.reference)), [fieldItems]);
  const referenceFieldMap = useMemo<Record<string, FieldItem>>(() => {
    const map: Record<string, FieldItem> = {};
    referenceFields.forEach((field) => {
      map[field.field] = field;
    });
    return map;
  }, [referenceFields]);

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
  const [referenceSearchTerms, setReferenceSearchTerms] = useState<Record<string, string>>({});
  const [referenceSelections, setReferenceSelections] = useState<Record<string, ReferenceOption | null>>({});
  const [referenceDropdownOpen, setReferenceDropdownOpen] = useState<Record<string, boolean>>({});
  const referenceSearchTimers = useRef<Record<string, number | undefined>>({});

  const resetReferenceState = useCallback(() => {
    Object.values(referenceSearchTimers.current).forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    referenceSearchTimers.current = {};
    setReferenceOptions({});
    setReferenceLoading({});
    setReferenceErrors({});
    setReferenceSearchTerms({});
    setReferenceSelections({});
    setReferenceDropdownOpen({});
  }, [
    setReferenceOptions,
    setReferenceLoading,
    setReferenceErrors,
    setReferenceSearchTerms,
    setReferenceSelections,
    setReferenceDropdownOpen
  ]);

  useEffect(() => {
    if (isListForm) {
      setRecord(null);
      setRecordLoading(false);
      setRecordError(null);
      setFormValues({});
      resetReferenceState();
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);

    if (!primaryEntity) {
      setRecord(null);
      setRecordLoading(false);
      setRecordError('Ця форма не має сутності для відображення.');
      setFormValues(buildInitialValues(fieldItems, null));
      resetReferenceState();
      return;
    }

    if (!recordId) {
      setRecord(null);
      setRecordLoading(false);
      setRecordError(null);
      setFormValues(buildInitialValues(fieldItems, null));
      resetReferenceState();
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    setRecordError(null);
    resetReferenceState();

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
  }, [fieldItems, isListForm, primaryEntity, recordId, resetReferenceState]);

  const loadReferenceOptions = useCallback(
    async (fieldCode: string, searchTerm = '') => {
      const field = referenceFieldMap[fieldCode];
      if (!field || !field.reference) {
        return;
      }

      setReferenceLoading((previous) => ({ ...previous, [fieldCode]: true }));
      setReferenceErrors((previous) => ({ ...previous, [fieldCode]: '' }));

      try {
        const normalized = searchTerm.trim();
        const options = await searchEntityReference(field.reference.entity, {
          search: normalized.length ? normalized : undefined,
          limit: 20,
          labelField: field.reference.labelField
        });
        setReferenceOptions((previous) => ({ ...previous, [fieldCode]: options }));
      } catch (error) {
        console.error(`Failed to load options for ${fieldCode}`, error);
        setReferenceOptions((previous) => ({ ...previous, [fieldCode]: [] }));
        setReferenceErrors((previous) => ({ ...previous, [fieldCode]: 'Не вдалося завантажити варіанти.' }));
      } finally {
        setReferenceLoading((previous) => ({ ...previous, [fieldCode]: false }));
      }
    },
    [referenceFieldMap]
  );

  const loadReferenceSelection = useCallback(
    async (fieldCode: string, value: string) => {
      const field = referenceFieldMap[fieldCode];
      if (!field || !field.reference || !value) {
        return;
      }

      try {
        const options = await searchEntityReference(field.reference.entity, {
          values: [value],
          labelField: field.reference.labelField
        });
        const selection = options[0] ?? { value, label: value };
        setReferenceSelections((previous) => ({ ...previous, [fieldCode]: selection }));
        setReferenceSearchTerms((previous) => ({ ...previous, [fieldCode]: selection.label }));
      } catch (error) {
        console.error(`Failed to resolve reference value for ${fieldCode}`, error);
        setReferenceSelections((previous) => ({ ...previous, [fieldCode]: { value, label: value } }));
        setReferenceSearchTerms((previous) => ({ ...previous, [fieldCode]: value }));
        setReferenceErrors((previous) => ({ ...previous, [fieldCode]: 'Не вдалося завантажити вибране значення.' }));
      }
    },
    [referenceFieldMap]
  );

  useEffect(() => {
    referenceFields.forEach((field) => {
      const fieldCode = field.field;
      const currentValue = formValues[fieldCode];

      if (typeof currentValue === 'string' && currentValue) {
        const currentSelection = referenceSelections[fieldCode];
        if (!currentSelection || currentSelection.value !== currentValue) {
          loadReferenceSelection(fieldCode, currentValue);
        } else if (!referenceSearchTerms[fieldCode]) {
          setReferenceSearchTerms((previous) => ({ ...previous, [fieldCode]: currentSelection.label }));
        }
      }
    });
  }, [referenceFields, formValues, loadReferenceSelection, referenceSelections, referenceSearchTerms]);

  useEffect(() => {
    return () => {
      Object.values(referenceSearchTimers.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, []);

  const handleReferenceInputFocus = useCallback(
    (fieldCode: string) => {
      setReferenceDropdownOpen((previous) => ({ ...previous, [fieldCode]: true }));
      const term = referenceSearchTerms[fieldCode] ?? '';
      loadReferenceOptions(fieldCode, term);
    },
    [loadReferenceOptions, referenceSearchTerms]
  );

  const handleReferenceInputBlur = useCallback((fieldCode: string) => {
    window.setTimeout(() => {
      setReferenceDropdownOpen((previous) => ({ ...previous, [fieldCode]: false }));
    }, 150);
  }, []);

  const handleReferenceInputChange = useCallback(
    (fieldCode: string, term: string) => {
      setReferenceSearchTerms((previous) => ({ ...previous, [fieldCode]: term }));
      setReferenceSelections((previous) => {
        const existing = previous[fieldCode];
        if (!existing) {
          return previous;
        }
        if (existing.label === term) {
          return previous;
        }
        return { ...previous, [fieldCode]: null };
      });
      setReferenceErrors((previous) => ({ ...previous, [fieldCode]: '' }));
      setReferenceDropdownOpen((previous) => ({ ...previous, [fieldCode]: true }));
      setFormValues((previous) => ({ ...previous, [fieldCode]: '' }));
      setSaveError(null);
      setSaveSuccess(null);

      const timers = referenceSearchTimers.current;
      const existingTimer = timers[fieldCode];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      timers[fieldCode] = window.setTimeout(() => {
        loadReferenceOptions(fieldCode, term);
      }, 250);
    },
    [loadReferenceOptions]
  );

  const handleReferenceSelectOption = useCallback(
    (fieldCode: string, option: ReferenceOption) => {
      setReferenceSelections((previous) => ({ ...previous, [fieldCode]: option }));
      setReferenceSearchTerms((previous) => ({ ...previous, [fieldCode]: option.label }));
      setReferenceOptions((previous) => {
        const existing = previous[fieldCode] ?? [];
        const deduped = [option, ...existing.filter((candidate) => candidate.value !== option.value)];
        return { ...previous, [fieldCode]: deduped };
      });
      setFormValues((previous) => ({ ...previous, [fieldCode]: option.value }));
      setReferenceDropdownOpen((previous) => ({ ...previous, [fieldCode]: false }));
      const timers = referenceSearchTimers.current;
      const existingTimer = timers[fieldCode];
      if (existingTimer) {
        clearTimeout(existingTimer);
        timers[fieldCode] = undefined;
      }
      setSaveError(null);
      setSaveSuccess(null);
    },
    []
  );

  const handleReferenceClear = useCallback(
    (fieldCode: string) => {
      setReferenceSelections((previous) => ({ ...previous, [fieldCode]: null }));
      setReferenceSearchTerms((previous) => ({ ...previous, [fieldCode]: '' }));
      setReferenceDropdownOpen((previous) => ({ ...previous, [fieldCode]: false }));
      setReferenceOptions((previous) => ({ ...previous, [fieldCode]: [] }));
      setFormValues((previous) => ({ ...previous, [fieldCode]: '' }));
      const timers = referenceSearchTimers.current;
      const existingTimer = timers[fieldCode];
      if (existingTimer) {
        clearTimeout(existingTimer);
        timers[fieldCode] = undefined;
      }
      setSaveError(null);
      setSaveSuccess(null);
    },
    []
  );

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
                    const fieldReferenceOptions = referenceOptions[item.field] ?? [];
                    const needsFallbackOption = Boolean(
                      value && !fieldReferenceOptions.some((option) => option.value === value)
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
                        ) : item.reference ? (
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              value={referenceSearchTerms[item.field] ?? ''}
                              onFocus={() => handleReferenceInputFocus(item.field)}
                              onBlur={() => handleReferenceInputBlur(item.field)}
                              onChange={(event) => handleReferenceInputChange(item.field, event.target.value)}
                              placeholder="Почніть вводити для пошуку"
                              style={{
                                width: '100%',
                                padding: '0.5rem 2.5rem 0.5rem 0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #d1d5db'
                              }}
                            />
                            {referenceSelections[item.field] ? (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleReferenceClear(item.field)}
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  right: '0.5rem',
                                  transform: 'translateY(-50%)',
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: '#6b7280'
                                }}
                                aria-label="Очистити вибране"
                              >
                                ×
                              </button>
                            ) : null}
                            {referenceDropdownOpen[item.field] ? (
                              <div
                                style={{
                                  position: 'absolute',
                                  zIndex: 10,
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  marginTop: '0.25rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '0.5rem',
                                  background: '#fff',
                                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                                  maxHeight: '240px',
                                  overflowY: 'auto'
                                }}
                              >
                                {referenceLoading[item.field] ? (
                                  <div style={{ padding: '0.75rem', color: '#6b7280' }}>Завантаження…</div>
                                ) : null}
                                {referenceErrors[item.field] ? (
                                  <div style={{ padding: '0.75rem', color: '#c0392b' }}>
                                    {referenceErrors[item.field]}
                                  </div>
                                ) : null}
                                {!referenceLoading[item.field] && !referenceErrors[item.field] ? (
                                  fieldReferenceOptions.length ? (
                                    fieldReferenceOptions.map((option) => {
                                      const selected = referenceSelections[item.field]?.value === option.value;
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => handleReferenceSelectOption(item.field, option)}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            gap: '0.15rem',
                                            width: '100%',
                                            border: 'none',
                                            background: selected ? '#eff6ff' : '#fff',
                                            color: '#111827',
                                            textAlign: 'left',
                                            padding: '0.6rem 0.85rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f3f4f6'
                                          }}
                                        >
                                          <span>{option.label}</span>
                                          {option.label !== option.value ? (
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{option.value}</span>
                                          ) : null}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div style={{ padding: '0.75rem', color: '#6b7280' }}>Нічого не знайдено</div>
                                  )
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : item.widget === 'select' ? (
                          <select
                            value={value}
                            onChange={(event) => handleFieldChange(item.field, event)}
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                          >
                            <option value="">Не обрано</option>
                            {needsFallbackOption ? <option value={value}>{value}</option> : null}
                            {fieldReferenceOptions.map((option) => (
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
                        {item.reference
                          ? (() => {
                              const helperText = referenceErrors[item.field]
                                ? referenceErrors[item.field]
                                : referenceSelections[item.field]
                                  ? `Обране значення: ${referenceSelections[item.field]?.label}`
                                  : referenceLoading[item.field]
                                    ? 'Завантаження варіантів…'
                                    : 'Почніть вводити, щоб знайти значення.';
                              return helperText ? (
                                <span
                                  style={{
                                    fontSize: '0.8rem',
                                    color: referenceErrors[item.field] ? '#c0392b' : '#6b7280'
                                  }}
                                >
                                  {helperText}
                                </span>
                              ) : null;
                            })()
                          : item.widget === 'select'
                            ? (() => {
                                const helperText = fieldReferenceOptions.length ? 'Виберіть значення зі списку.' : '';
                                return helperText ? (
                                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{helperText}</span>
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

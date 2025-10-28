# TableView: динамічний список, пагінація, пошук/фільтри/сортування

Цей документ описує контракт і кроки, необхідні для перетворення `TableView` на універсальний динамічний список із підтримкою великих наборів даних, пагінації, пошуку, фільтрів і сортування. Рішення охоплює як сервер, так і клієнт, і дозволяє розробникам на базі Амадін визначати власні запити й унікальні ключі.

## Цілі
- Витягувати дані порціями (cursor-based), щоб масштабуватись на великі таблиці.
- Зберігати контекст пошуку/фільтрів/сортування у пагінації.
- Забезпечити детермінований порядок (унікальний ключ як tie-breaker).
- Дозволити кастомний базовий запит або джерело по сутності.
- Надати простий, типобезпечний контракт між клієнтом і сервером.

## Поточний стан (аудит)
- `client/src/components/TableView.tsx` завантажує всі рядки одразу через `fetchEntityRows` і рендерить без колонок, пагінації чи станів завантаження.
- `client/src/api/index.ts` експорт `fetchEntityRows(entityCode)` виконує `GET /api/entities/:entityCode` без параметрів; очікує масив `data`.
- `server/routes/api/entities.ts` обробник `GET /entities/:entityCode` повертає всі записи (`listEntities`) з in-memory стора без сортування/фільтрів/пагінації.
- `server/utils/prismaLoader.ts` тримає демо-дані в Map; `listEntities` повертає копію масиву записів без обмежень.
- Відсутні унікальні ключі, курсори, обмеження на розмір відповіді, також немає пошуку/фільтрів/сортування чи конфігурації запитів.

## Контракт API списку

URL: `GET /api/entities/:entityCode/list`

Типи/схеми: `types/entityList.ts` містить Zod-схеми `listQuerySchema`, `listCursorSchema`, `listResponseSchema` та допоміжні типи для фільтрів/сортування.

Запит (query params або JSON для POST — на розсуд, нижче варіант із query params для простоти):

- `pageSize?: number` — [1..200], дефолт 50
- `cursor?: string` — прозорий курсор (base64 JSON)
- `search?: string` — простий пошук по allowlist полів
- `filters?: string` — base64 JSON масиву фільтрів
- `sort?: string` — base64 JSON масиву дескрипторів сортування
- `uniqueKey?: string` — явний унікальний ключ (дефолт: `id`), може бути визначений у конфігурації

Фільтри (DSL, JSON):
```
[
  { "field": "status", "op": "eq", "value": "active" },
  { "field": "total", "op": "gte", "value": 100 }
]
```
Допустимі `op`: `eq, neq, gt, gte, lt, lte, in, contains, startsWith` (allowlist; мапимо на Prisma без eval/інʼєкцій).

Сортування (масив, JSON):
```
[
  { "field": "createdAt", "dir": "desc" }
]
```
Сервер автоматично додає вторинне сортування за `uniqueKey` для стабільності, якщо цього немає у запиті.

Відповідь:
```
{
  "items": Array<Record<string, unknown>>,
  "pageInfo": {
    "nextCursor": string | null,
    "hasNext": boolean
  },
  "effectiveSort": Array<{ field: string; dir: 'asc'|'desc' }>,
  "uniqueKey": string,
  "debug"?: { total?: number, timingMs?: number }
}
```

Cursor payload (напр. JSON до base64):
```
{
  "lastKey": any,                 // значення поля uniqueKey останнього елемента
  "lastSort": Record<string,any>, // значення полів сортування останнього елемента
  "querySig": string              // хеш параметрів (search/filters/sort/uniqueKey), щоб курсор був валідним тільки для цього запиту
}
```

## Сервер: реалізація
- Валідація параметрів (zod): `pageSize`, `filters`, `sort`, `search`, `uniqueKey` (перевірка allowlist полів).
- Побудова Prisma `where`/`orderBy` за DSL. Якщо в `orderBy` немає `uniqueKey`, додати `{ [uniqueKey]: 'asc' }`/`desc` для детермінованості.
- Cursor-based пагінація:
  - Для multi-field sort застосувати курсор формату `{ field1: val1, field2: val2, uniqueKey: lastKey }`.
  - Використовувати `take: pageSize + 1` для визначення `hasNext`.
- Конфігурований базовий запит:
  - За замовчуванням — джерело по сутності `entityCode`.
  - Опціонально: резолвер у конфігурації (наприклад, імʼя функції/модуля), який повертає Prisma-предикати/joins/вибірку.
- Повернути `effectiveSort` та `uniqueKey` у відповіді.
- Обмеження: `maxPageSize`, таймаути, захист від важких фільтрів (чорний список), аудит.

## Клієнт: архітектура
- Хук `useEntityList` керує станом параметрів (search, filters, sort, uniqueKey), сторінками і курсором, `loading/error`, відміною запитів (AbortController).
- Публічне API хука:
```
const {
  items, loadMore, reset, loading, error,
  params, setSearch, setFilters, setSort, setUniqueKey,
  pageInfo
} = useEntityList({ entityCode, pageSize, initialParams });
```
- Infinite scroll через `IntersectionObserver` або кнопку "Load more" як fallback. Віртуалізація рядків (react-window) для продуктивності.
- `TableView` спирається на хук, рендерить динамічні колонки з маніфесту/схеми. Ключ рядка — `row[uniqueKey]` із fallback до стабільного хеша.
- Стан пошуку/фільтрів/сортування може синхронізуватись у URL (query string) для shareable посилань.

## Едж-кейси
- Нестабільне сортування (багато однакових значень) — завжди додаємо `uniqueKey`.
- Зміна параметрів під час завантаження — скасовувати активні запити, робити `reset()`.
- Зміна базового джерела/конфігурації — інвалідовувати кеш і курсор (через `querySig`).
- Поля, яких немає у allowlist — повертати 400 із детальним повідомленням.
- Дуже великі сторінки — обрізати до `maxPageSize`, логувати.

## Приклади

Запит (query):
```
/api/entities/invoice/list?pageSize=50&sort=W3siZmllbGQiOiJjcmVhdGVkQXQiLCJkaXIiOiJkZXNjIn1d&filters=W3siZmllbGQiOiJzdGF0dXMiLCJvcCI6ImVxIiwidmFsdWUiOiJhY3RpdmUifV0
```

Відповідь:
```
{
  "items": [ { "id": "...", "number": "INV-001", ... } ],
  "pageInfo": { "nextCursor": "eyJsYXN0S2V5IjoiLi4uIiwibGFzdFNvcnQiOnsiY3JlYXRlZEF0IjoiMjAyNS0wOS0wMSJ9LCJxdWVyeVNpZyI6Ii0tLWhhc2gtdmFsdWUtLS0ifQ==", "hasNext": true },
  "effectiveSort": [ { "field": "createdAt", "dir": "desc" }, { "field": "id", "dir": "asc" } ],
  "uniqueKey": "id"
}
```

## Кроки впровадження (узгоджено з TODO)
1. Аудит поточного `TableView` та API.
2. Специфікація контракту і DSL, типи (zod).
3. Серверна реалізація курсорної пагінації + тести.
4. Конфігурація базового запиту/унікального ключа.
5. Клієнтський хук `useEntityList`.
6. Віртуалізація та нескінченний скрол.
7. UI контролів пошуку/фільтрів/сортування.
8. Документація і план розгортання з фіче-флагом.

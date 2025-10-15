# Конфігурація

## Core

Файл `core/core.prisma` описує метамодель. Змінивши її, ви розширюєте можливості генератора.

## Demo-config

`examples/demo-config.json` — приклад конфігурації застосунку. Ключові поля:

- `appId` — унікальний ідентифікатор застосунку.
- `entities` — масив сутностей з кодом, назвою та набором полів.
- `forms` — опис форм із переліком реквізитів.

```json
{
  "code": "invoiceForm",
  "layout": [
    { "entity": "invoice", "field": "number", "widget": "input" }
  ]
}
```

## Генерація

Запустіть `npm run generate` (або `npm run cli -- generate`) щоб створити `generated/app.prisma` і `generated/ui-manifest.json`.

# Localy

Localy — локальная CRM и платформа лояльности для малого бизнеса. В MVP есть ASCII-интерфейс, онбординг, касса с QR, CRM, акции, рассылки, публичный сайт с записью, аналитика, тарифы и админ-панель.

## Запуск

```bash
npm install
npm run dev
```

Откройте <http://localhost:3000>. Демо-данные детерминированы и хранятся в `data/localy.json`.

## Демо-вход

Пароль всех аккаунтов: `Localy2026`.

- `owner@localy.kz` — владелец
- `admin@localy.kz` — администратор бизнеса
- `marketing@localy.kz` — маркетолог
- `cashier@localy.kz` — кассир
- `platform@localy.kz` — админ Localy

## Проверка

```bash
npm run lint
npm run build
npm run smoke:e2e
```

`smoke:e2e` запускает изолированный production-сервер и проверяет основной сценарий в headless Chrome: онбординг, QR, кассу, бонусы, CRM, рассылки, роли, админку и публичную заявку.

По умолчанию приложение использует полностью рабочее JSON-хранилище. Supabase-адаптер пока заглушка и включается только явно через `LOCALY_REPO=supabase`.

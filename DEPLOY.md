# Деплой HurmaStr через Docker

Застосунок: Next.js 16 + Prisma 7 + **SQLite** (вбудована файлова БД, без окремого
сервера БД). Розрахований на **один інстанс** (SQLite не масштабується горизонтально).

## Що потрібно

- Docker + Docker Compose
- Постійне сховище під два томи (БД і вкладення довідок)
- (Рекомендовано) реверс-проксі з HTTPS (nginx / Traefik / Caddy)

## Швидкий старт

```bash
# 1. Секрет сесій і базові налаштування
cp .env.docker.example .env
#   відкрийте .env і заповніть:
#   AUTH_SECRET=$(openssl rand -base64 48)
#   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

# 2. Збірка й запуск
docker compose up -d --build

# 3. Логи першого старту (схема + наповнення)
docker compose logs -f
```

Після старту застосунок на `http://<host>:3000`. Увійдіть під `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` і **одразу змініть пароль** у профілі.

## Обов'язкові змінні оточення

| Змінна | Опис |
|---|---|
| `AUTH_SECRET` | **Обов'язково.** Довгий випадковий рядок для підпису сесій. Без нього застосунок не стартує. `openssl rand -base64 48` |
| `DATABASE_URL` | Шлях до SQLite. У compose вже задано `file:/data/app.db` (том). Не змінюйте без міграції даних |
| `COOKIE_SECURE` | `true` **лише за HTTPS**. Для доступу по HTTP лишіть `false`, інакше cookie сесії не збережеться і вхід не працюватиме |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Перший адміністратор (створюється раз, при першому старті) |
| `PORT` | Порт на хості (у контейнері завжди 3000) |
| `SEED_DEMO` | `false` у проді (демо-персонал не створюється). За замовчуванням false |
| `RUN_SEED` | `true` — застосувати базові дані при старті (типи відсутностей, відділи, адмін). Ідемпотентно |

## Дані та бекапи

Усе, що треба зберігати, — на **двох іменованих томах**:

| Том | Вміст | Навіщо |
|---|---|---|
| `hurma-data` → `/data` | `app.db` — уся база (люди, заявки, баланси…) | головні дані |
| `hurma-storage` → `/app/storage` | фото/скани довідок до лікарняних | вкладення |

**Бекап:**
```bash
# БД (гарячий бекап SQLite)
docker compose exec hurmastr node_modules/.bin/prisma db execute --stdin <<< ".backup /data/backup.db" || \
docker run --rm -v hurmastr_hurma-data:/data -v "$PWD:/out" busybox cp /data/app.db /out/app-backup.db

# Вкладення
docker run --rm -v hurmastr_hurma-storage:/s -v "$PWD:/out" busybox tar czf /out/storage-backup.tgz -C /s .
```

## Оновлення версії

```bash
git pull                       # або передайте новий образ
docker compose up -d --build   # схема оновиться при старті (prisma db push)
```

Схема застосовується автоматично при кожному старті (`prisma db push`) — додавання
нових полів/таблиць безпечне й неруйнівне. Дані на томах зберігаються.

## HTTPS (рекомендовано)

Ставте застосунок за реверс-проксі з TLS і виставте `COOKIE_SECURE=true`.
Приклад для nginx: проксіювати `:443` → `hurmastr:3000`, передавати
`X-Forwarded-For` (використовується rate-limit'ом входу).

## Обмеження

- **SQLite = один інстанс.** Не запускайте кілька реплік на одному томі. Для
  горизонтального масштабування — міграція на PostgreSQL (див. розділ у `README.md`:
  зміна `provider` та адаптера Prisma).
- Rate-limit входу тримається в пам'яті процесу (скидається при рестарті) — цього
  достатньо для одного інстансу.

## Перевірка здоров'я

У образ вбудовано `HEALTHCHECK` (пінг `/login`). Стан:
```bash
docker compose ps
docker inspect --format '{{.State.Health.Status}}' hurmastr
```

## Локальний тест образу (без compose)

```bash
docker build -t hurmastr:latest .
docker run --rm -p 3000:3000 \
  -e AUTH_SECRET="$(openssl rand -base64 48)" \
  -e DATABASE_URL="file:/data/app.db" \
  -e SEED_ADMIN_EMAIL="admin@company.com" \
  -e SEED_ADMIN_PASSWORD="change-me" \
  -v hurma-data:/data -v hurma-storage:/app/storage \
  hurmastr:latest
```

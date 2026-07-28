#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Старт контейнера HurmaStr:
#   1) перевіряємо обов'язкові env;
#   2) застосовуємо схему до БД на томі (prisma db push);
#   3) наповнюємо базовими даними (типи відсутностей, відділи, адмін) —
#      демо-персонал за замовчуванням ВИМКНЕНО (SEED_DEMO=false);
#   4) запускаємо сервер.
# ---------------------------------------------------------------------------

: "${DATABASE_URL:?DATABASE_URL не задано (напр. file:/data/app.db)}"
: "${AUTH_SECRET:?AUTH_SECRET не задано — згенеруйте довгий випадковий рядок}"

echo "→ [1/3] Застосування схеми БД (prisma db push)"
# Прим.: --skip-generate у Prisma 7 db push НЕ підтримується; db push і так не
# генерує клієнт. Аддитивні зміни (нові поля/таблиці) застосовуються без запитів.
node_modules/.bin/prisma db push

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "→ [2/3] Наповнення базовими даними (SEED_DEMO=${SEED_DEMO:-false})"
  SEED_DEMO="${SEED_DEMO:-false}" node_modules/.bin/tsx prisma/seed.ts \
    || echo "  ⚠ крок наповнення завершився з помилкою — продовжуємо старт"
else
  echo "→ [2/3] Наповнення пропущено (RUN_SEED=false)"
fi

echo "→ [3/3] Запуск Next.js на 0.0.0.0:${PORT:-3000}"
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"

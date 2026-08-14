import { type NextRequest } from "next/server";
import { API_HEADERS, requireApiToken } from "@/lib/api-v1";

/**
 * GET /api/v1 — індекс машинного API: перелік доступних ендпоінтів.
 *   Authorization: Bearer <API_TOKEN>
 */
export async function GET(request: NextRequest) {
  const denied = requireApiToken(request);
  if (denied) return denied;

  return Response.json(
    {
      version: 1,
      endpoints: {
        "GET /api/v1/employees":
          "Усі працюючі співробітники. Фільтри: ?q=<пошук>, ?team=<id|назва відділу>, ?manager=<id> (прямі підлеглі)",
        "GET /api/v1/employees/{id}":
          "Детально про одного: + місто, тип зайнятості, випробувальний, прямі підлеглі",
        "GET /api/v1/managers":
          "Усі керівники (керівна посада або фактичні підлеглі) з reports і головуванням у відділах",
        "GET /api/v1/teams":
          "Команди (відділи): керівник, кількість і склад працюючих",
      },
      notes:
        "Звільнені та архівні ніде не віддаються. Платіжних даних у API немає. Авторизація: Authorization: Bearer <API_TOKEN>.",
    },
    { headers: API_HEADERS },
  );
}

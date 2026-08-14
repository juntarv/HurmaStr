import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { buildSearchKey } from "@/server/schemas/employee";

/**
 * Тестовий рядовий співробітник з керівником «Шеруда Артем» — для перевірки,
 * які дані бачить керівник про підлеглого (і навпаки).
 *
 * Створює/оновлює картку «Тестовий Працівник» (усі чутливі поля заповнені
 * тестовими значеннями) і акаунт EMPLOYEE з відомим паролем.
 * Ідемпотентний — можна ганяти повторно. Картку легко видалити з адмінки.
 */

const EMAIL = "test.employee@hurmastr.app";
const PASSWORD = "TestEmp2026";

async function main() {
  const artem = await prisma.employee.findFirst({
    where: { lastName: "Шеруда", firstName: "Артем", isArchived: false },
    select: { id: true, departmentId: true },
  });
  if (!artem) throw new Error("Не знайдено картку «Шеруда Артем»");

  // Не-керівна посада, бажано з відділу Артема.
  const position =
    (await prisma.position.findFirst({
      where: {
        isArchived: false,
        isManagerial: false,
        ...(artem.departmentId ? { departmentId: artem.departmentId } : {}),
      },
      select: { id: true, title: true },
    })) ??
    (await prisma.position.findFirst({
      where: { isArchived: false, isManagerial: false },
      select: { id: true, title: true },
    }));

  const data = {
    lastName: "Тестовий",
    firstName: "Працівник",
    gender: "MALE" as const,
    birthDate: new Date(Date.UTC(1995, 4, 15)),
    hireDate: new Date(Date.UTC(2026, 5, 1)),
    probationEndDate: new Date(Date.UTC(2026, 8, 1)),
    status: "ACTIVE" as const,
    employmentType: "FULL_TIME" as const,
    workEmail: EMAIL,
    personalEmail: "test.personal@example.com",
    phone: "+380501112233",
    telegram: "@test_employee",
    mattermost: "@test.employee",
    city: "Київ",
    emergencyContactName: "Контакт Екстрений",
    emergencyContactPhone: "+380507654321",
    // Платіжні дані заповнені, щоб перевірити: керівник їх бачити НЕ має.
    payoutTotal: 1000,
    payoutCurrency: "USDT",
    paymentType: "CRYPTO" as const,
    payoutAmount: 700,
    walletAddress: "TTestWallet1234567890",
    paymentType2: "FOP" as const,
    payoutAmount2: 300,
    walletAddress2: "UA000000000000000000 (тест ФОП)",
    note: "Тестова картка для перевірки видимості даних — можна видалити",
    departmentId: artem.departmentId,
    positionId: position?.id ?? null,
    managerId: artem.id,
    searchKey: buildSearchKey(["Тестовий", "Працівник", EMAIL]),
  };

  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { employeeId: true },
  });
  const employee = existing?.employeeId
    ? await prisma.employee.update({ where: { id: existing.employeeId }, data })
    : await prisma.employee.create({ data });

  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
      employeeId: employee.id,
      inviteAcceptedAt: new Date(),
    },
    update: {
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
      employeeId: employee.id,
      tokenVersion: { increment: 1 },
    },
  });

  console.log("✓ Тестовий працівник готовий");
  console.log(`  Картка: ${employee.id} · посада: ${position?.title ?? "—"}`);
  console.log(`  Керівник: Шеруда Артем (${artem.id})`);
  console.log(`  Логін:  ${EMAIL}`);
  console.log(`  Пароль: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

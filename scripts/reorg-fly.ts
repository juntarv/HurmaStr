import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { buildSearchKey } from "@/server/schemas/employee";

/**
 * Реорганізація компанії у мінімальну формальну структуру:
 *   Менеджмент: CEO, COO, Асистент COO (без імен, без акаунтів)
 *   iOS:  Артем Шеруда (Head, = акаунт адміна), 2 розробники, 1 дизайнер
 *   Android: 1 тімлід, 4 розробники
 * Усіх інших демо-людей і майно — видаляємо.
 */

const HIRE = new Date(Date.UTC(2025, 0, 1));

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, employeeId: true, email: true },
  });
  if (!admin?.employeeId) throw new Error("Не знайдено акаунт адміністратора з карткою");
  const adminEmp = admin.employeeId;

  const deps = await prisma.department.findMany({ select: { id: true, name: true } });
  const dep = (n: string) => {
    const d = deps.find((x) => x.name === n);
    if (!d) throw new Error(`Немає відділу «${n}»`);
    return d.id;
  };
  const MGMT = dep("Менеджмент");
  const IOS = dep("iOS Development");
  const ANDROID = dep("Android Development");

  // --- 1. Прибрати всіх, крім картки адміна ---
  const others = (
    await prisma.employee.findMany({ where: { id: { not: adminEmp } }, select: { id: true } })
  ).map((e) => e.id);
  await prisma.user.deleteMany({ where: { employeeId: { in: others } } });
  await prisma.asset.deleteMany({});
  await prisma.employee.deleteMany({ where: { id: { in: others } } });
  console.log(`✓ Видалено співробітників: ${others.length}, усе майно`);

  // --- 2. Посади (find-or-create). isManagerial = може бути керівником
  //        (вище керівництво, хеди, тімліди). Прості посади — ні. ---
  async function pos(title: string, departmentId: string, isManagerial = false) {
    const ex = await prisma.position.findFirst({ where: { title, departmentId } });
    if (ex) {
      return prisma.position.update({ where: { id: ex.id }, data: { isManagerial } });
    }
    return prisma.position.create({ data: { title, departmentId, isManagerial } });
  }
  const pCEO = await pos("CEO", MGMT, true);
  const pCOO = await pos("COO", MGMT, true);
  const pAsst = await pos("Асистент COO", MGMT, true);
  const pHeadIOS = await pos("Head of iOS", IOS, true);
  const pIOSDev = await pos("iOS Developer", IOS, false);
  const pDesigner = await pos("Designer", IOS, false);
  const pAndLead = await pos("Android Team Lead", ANDROID, true);
  const pAndDev = await pos("Android Developer", ANDROID, false);

  // --- 3. Керівництво (без імен, без акаунтів) ---
  async function person(data: {
    lastName: string;
    firstName?: string;
    departmentId: string;
    positionId: string;
    managerId?: string | null;
  }) {
    const firstName = data.firstName ?? "";
    return prisma.employee.create({
      data: {
        lastName: data.lastName,
        firstName,
        departmentId: data.departmentId,
        positionId: data.positionId,
        managerId: data.managerId ?? null,
        hireDate: HIRE,
        status: "ACTIVE",
        searchKey: buildSearchKey([data.lastName, firstName]),
      },
    });
  }

  const ceo = await person({ lastName: "CEO", departmentId: MGMT, positionId: pCEO.id, managerId: null });
  const coo = await person({ lastName: "COO", departmentId: MGMT, positionId: pCOO.id, managerId: ceo.id });

  // --- 4. Картка адміна → Асистент COO (адмін-доступ у нього) ---
  await prisma.employee.update({
    where: { id: adminEmp },
    data: {
      lastName: "Асистент COO",
      firstName: "",
      departmentId: MGMT,
      positionId: pAsst.id,
      managerId: coo.id,
      status: "ACTIVE",
      isArchived: false,
      archivedAt: null,
      terminationDate: null,
      searchKey: buildSearchKey(["Асистент COO", admin.email]),
    },
  });

  // --- 5. iOS: Head — окрема картка Артема (без акаунта) + 2 розробники + дизайнер ---
  const artem = await person({ lastName: "Шеруда", firstName: "Артем", departmentId: IOS, positionId: pHeadIOS.id, managerId: coo.id });
  await person({ lastName: "Розробник iOS 1", departmentId: IOS, positionId: pIOSDev.id, managerId: artem.id });
  await person({ lastName: "Розробник iOS 2", departmentId: IOS, positionId: pIOSDev.id, managerId: artem.id });
  await person({ lastName: "Дизайнер", departmentId: IOS, positionId: pDesigner.id, managerId: artem.id });

  // --- 6. Android команда: 1 тімлід + 4 розробники ---
  const lead = await person({ lastName: "Тімлід Android", departmentId: ANDROID, positionId: pAndLead.id, managerId: coo.id });
  for (let i = 1; i <= 4; i++) {
    await person({ lastName: `Розробник Android ${i}`, departmentId: ANDROID, positionId: pAndDev.id, managerId: lead.id });
  }

  // --- 7. Керівники відділів ---
  await prisma.department.update({ where: { id: MGMT }, data: { headId: ceo.id } });
  await prisma.department.update({ where: { id: IOS }, data: { headId: artem.id } });
  await prisma.department.update({ where: { id: ANDROID }, data: { headId: lead.id } });

  // --- 8. Прибрати посади без співробітників (чистимо демо-сміття) ---
  const orphanPos = await prisma.position.findMany({
    where: { employees: { none: {} } },
    select: { id: true },
  });
  await prisma.position.deleteMany({ where: { id: { in: orphanPos.map((p) => p.id) } } });
  console.log(`✓ Прибрано зайвих посад: ${orphanPos.length}`);

  const total = await prisma.employee.count();
  console.log(`✓ Готово. Співробітників у компанії: ${total}`);
  console.log("  Менеджмент: CEO, COO, Асистент COO");
  console.log("  iOS: Артем Шеруда (Head) + 2 розробники + дизайнер");
  console.log("  Android: Тімлід + 4 розробники");
}

main()
  .catch((e) => {
    console.error("Помилка реорганізації:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

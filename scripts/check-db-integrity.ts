import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/** Перевіряє, що зовнішні ключі SQLite реально працюють (onDelete: Restrict). */
async function main() {
  const type = await prisma.leaveType.create({
    data: { code: "__FK_TEST__", nameUk: "Тест FK", affectsBalance: true },
  });
  const emp = await prisma.employee.create({
    data: { lastName: "Тест", firstName: "ФК", hireDate: new Date(), searchKey: "тест фк" },
  });
  await prisma.leaveRequest.create({
    data: {
      number: "__FK-TEST__", employeeId: emp.id, leaveTypeId: type.id,
      startDate: new Date(), endDate: new Date(), daysCount: 1,
    },
  });

  let restrictWorks = false;
  try {
    await prisma.leaveType.delete({ where: { id: type.id } });
  } catch (e) {
    restrictWorks = true;
    console.log("Restrict спрацював:", (e as Error).message.split("\n")[0].slice(0, 90));
  }

  // Прибираємо за собою
  await prisma.leaveRequest.deleteMany({ where: { number: "__FK-TEST__" } });
  await prisma.employee.delete({ where: { id: emp.id } });
  await prisma.leaveType.delete({ where: { id: type.id } });

  console.log(restrictWorks
    ? "OK: зовнішні ключі УВІМКНЕНІ, Restrict захищає довідники"
    : "ПРОБЛЕМА: FK вимкнені — тип із історією видалився без помилки!");
  process.exit(restrictWorks ? 0 : 1);
}
main();

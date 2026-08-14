import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { deleteAvatar, deleteEmployeeDocument } from "@/lib/uploads";

/**
 * Видаляє тестового співробітника, створеного create-test-employee.ts:
 * акаунт, картку (заявки/документи/коригування підуть каскадом),
 * файли фото й документів з диска. Ідемпотентний.
 */

const EMAIL = "test.employee@hurmastr.app";

async function main() {
  const account = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, employeeId: true },
  });
  const employee = account?.employeeId
    ? await prisma.employee.findUnique({
        where: { id: account.employeeId },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          avatarFile: true,
          documents: { select: { storedName: true } },
        },
      })
    : await prisma.employee.findUnique({
        where: { workEmail: EMAIL },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          avatarFile: true,
          documents: { select: { storedName: true } },
        },
      });

  if (!account && !employee) {
    console.log("Тестового співробітника немає — нічого видаляти.");
    return;
  }

  // Файли з диска (фото, документи) — до видалення записів.
  if (employee?.avatarFile) await deleteAvatar(employee.avatarFile);
  for (const doc of employee?.documents ?? []) {
    await deleteEmployeeDocument(doc.storedName);
  }

  if (account) await prisma.user.delete({ where: { id: account.id } });
  if (employee) {
    // Заявки/погодження/коригування/документи видаляться каскадом,
    // майно і підлеглі відв'яжуться (SetNull).
    await prisma.employee.delete({ where: { id: employee.id } });
  }

  console.log(
    `✓ Видалено: ${employee ? `картка ${employee.lastName} ${employee.firstName}` : "картки не було"}, ${account ? "акаунт " + EMAIL : "акаунта не було"}`,
  );
}

main()
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

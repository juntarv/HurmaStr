import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Уніфікує доступ адміністратора: гарантує єдиний ADMIN-акаунт з відомими
 * логіном і паролем. Працює однаково локально й на Fly.
 */
const EMAIL = (process.env.ADMIN_FIX_EMAIL ?? "admin@hurmastr.app").toLowerCase();
const PASS = process.env.ADMIN_FIX_PASSWORD ?? "HurmaAdmin2026";

async function main() {
  console.log("Акаунти ДО:");
  for (const u of await prisma.user.findMany({ select: { email: true, isActive: true, role: true } })) {
    console.log(`  ${u.email} | ${u.isActive ? "active" : "INACTIVE"} | ${u.role}`);
  }

  const hash = await bcrypt.hash(PASS, 10);
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  if (admin) {
    // Звільнити цільову пошту, якщо її тримає інший акаунт.
    const holder = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    if (holder && holder.id !== admin.id) await prisma.user.delete({ where: { id: holder.id } });

    await prisma.user.update({
      where: { id: admin.id },
      data: { email: EMAIL, passwordHash: hash, isActive: true, role: "ADMIN", tokenVersion: { increment: 1 } },
    });
    console.log(`\n✓ Адмін-доступ: ${EMAIL} / ${PASS}`);
  } else {
    const emp = await prisma.employee.findFirst({
      where: { OR: [{ workEmail: EMAIL }, { lastName: "Шеруда" }] },
      select: { id: true },
    });
    await prisma.user.create({
      data: { email: EMAIL, passwordHash: hash, role: "ADMIN", isActive: true, employeeId: emp?.id ?? null, inviteAcceptedAt: new Date() },
    });
    console.log(`\n✓ Створено адмін-акаунт: ${EMAIL} / ${PASS}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

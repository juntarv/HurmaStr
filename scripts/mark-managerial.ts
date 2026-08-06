import "dotenv/config";
import { prisma } from "@/lib/prisma";

/**
 * Позначає керівні посади (isManagerial=true) — саме вони доступні як
 * керівники у формі співробітника. «Прості» посади (розробник, дизайнер тощо)
 * лишаються false. Керівні = вище керівництво + хеди + тімліди.
 *
 * Ідемпотентний: керівним ставить true, решті — false. Можна ганяти будь-коли,
 * зокрема на Fly після деплою.
 */

// Ключові слова у назві посади (регістр не важливий).
const MANAGERIAL = [
  "ceo",
  "coo",
  "cto",
  "асистент coo",
  "head",
  "lead",
  "тімлід",
  "тимлид",
  "керівник",
  "директор",
  "director",
  "manager",
  "менеджер",
];

function isManagerial(title: string): boolean {
  const t = title.toLowerCase();
  return MANAGERIAL.some((kw) => t.includes(kw));
}

async function main() {
  const positions = await prisma.position.findMany({ select: { id: true, title: true } });
  let on = 0;
  let off = 0;
  for (const p of positions) {
    const flag = isManagerial(p.title);
    await prisma.position.update({ where: { id: p.id }, data: { isManagerial: flag } });
    if (flag) {
      on += 1;
      console.log(`  ✓ керівна: ${p.title}`);
    } else {
      off += 1;
    }
  }
  console.log(`\n✓ Готово. Керівних посад: ${on}, звичайних: ${off}`);
}

main()
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

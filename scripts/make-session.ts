import "dotenv/config";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/prisma";

/** Друкує валідний cookie сесії для вказаної пошти — для ручних перевірок. */
(async () => {
  const email = process.argv[2] ?? "admin@hurma.local";
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, tokenVersion: true },
  });
  const token = await new SignJWT({ tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  console.log(token);
})();

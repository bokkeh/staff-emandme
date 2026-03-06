import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
const authSecret = process.env.AUTH_SECRET;

if (!googleClientId || !googleClientSecret || !authSecret) {
  const missing = [
    !googleClientId ? "GOOGLE_CLIENT_ID (or AUTH_GOOGLE_ID)" : null,
    !googleClientSecret ? "GOOGLE_CLIENT_SECRET (or AUTH_GOOGLE_SECRET)" : null,
    !authSecret ? "AUTH_SECRET" : null,
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(`Missing auth environment variables: ${missing}`);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const employee = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true, role: true, firstName: true, lastName: true, status: true },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          employeeId: employee?.id ?? null,
          role: employee?.role ?? null,
          employeeStatus: employee?.status ?? null,
        },
      };
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  employeeId: string | null;
  role: Role | null;
};

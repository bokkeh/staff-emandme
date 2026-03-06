import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const isProd = process.env.NODE_ENV === "production";
const vercelUrl = process.env.VERCEL_URL;

function isLocalhostUrl(value?: string) {
  if (!value) return false;
  return value.includes("localhost") || value.includes("127.0.0.1");
}

if (isProd && isLocalhostUrl(process.env.NEXTAUTH_URL)) {
  delete process.env.NEXTAUTH_URL;
}
if (isProd && isLocalhostUrl(process.env.AUTH_URL)) {
  delete process.env.AUTH_URL;
}

if (isProd && !process.env.AUTH_URL && vercelUrl) {
  process.env.AUTH_URL = `https://${vercelUrl}`;
}
if (isProd && !process.env.NEXTAUTH_URL && vercelUrl) {
  process.env.NEXTAUTH_URL = `https://${vercelUrl}`;
}

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
const authSecret = process.env.AUTH_SECRET;
const hasGoogleProvider = Boolean(googleClientId && googleClientSecret);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Keep builds from failing when env vars are not available at build-time.
  // Runtime auth still requires real values in deployment env.
  secret: authSecret ?? "build-time-auth-secret-placeholder",
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: hasGoogleProvider
    ? [
        Google({
          clientId: googleClientId as string,
          clientSecret: googleClientSecret as string,
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = typeof token.sub === "string" ? token.sub : null;

      if (!session.user) return session;

      session.user.id = userId ?? "";

      // Middleware runs on Edge; avoid Prisma calls there.
      if (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined" || !userId) {
        return {
          ...session,
          user: {
            ...session.user,
            employeeId: null,
            role: null,
            employeeStatus: null,
          },
        };
      }

      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, role: true, firstName: true, lastName: true, status: true },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: userId,
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

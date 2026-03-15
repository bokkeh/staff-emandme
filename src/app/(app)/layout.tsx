import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/layout/session-provider";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const role = (session.user as { role?: string })?.role;
  const pendingCount =
    role === "ADMIN" || role === "MANAGER"
      ? await prisma.timeEntry.count({ where: { status: "SUBMITTED" } })
      : 0;

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar pendingApprovals={pendingCount} />
        <main className="flex-1 min-w-0 p-6 pt-20 lg:p-8">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}

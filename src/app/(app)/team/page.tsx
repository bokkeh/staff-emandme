import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TeamDirectoryClient } from "./team-directory-client";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();

  const employees = await prisma.employee.findMany({
    orderBy: [{ firstName: "asc" }],
    include: {
      manager: {
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Team Directory"
        description="Everyone at Em & Me Studio"
      />
      <TeamDirectoryClient
        employees={employees}
        currentUserRole={(session?.user as { role?: string })?.role ?? null}
      />
    </div>
  );
}

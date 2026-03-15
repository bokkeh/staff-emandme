import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionEmployeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;

  const url = new URL(req.url);
  const targetEmployeeId = url.searchParams.get("employeeId");

  // Determine which employee we're uploading for
  const employeeId =
    targetEmployeeId && (role === "ADMIN" || role === "MANAGER")
      ? targetEmployeeId
      : sessionEmployeeId;

  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  // Non-admin/manager can only upload for themselves
  if (role === "STAFF" && employeeId !== sessionEmployeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const blob = await put(`profile-photos/${employeeId}.${ext}`, file, {
    access: "public",
    allowOverwrite: true,
  });

  await prisma.employee.update({
    where: { id: employeeId },
    data: { profilePhotoUrl: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}

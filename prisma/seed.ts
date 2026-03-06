import { PrismaClient } from "@prisma/client";
import { addDays, startOfWeek, setHours, setMinutes } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Settings ────────────────────────────────────────────────────────────────
  const existingSettings = await prisma.appSettings.findFirst();
  if (!existingSettings) {
    await prisma.appSettings.create({
      data: {
        payPeriodType: "BIWEEKLY",
        overtimeWeeklyHours: 40,
        birthdaysVisibleToAll: false,
        updatedAt: new Date(),
      },
    });
  }

  // ─── Time Categories ─────────────────────────────────────────────────────────
  const categoryNames = [
    "Product Making",
    "Personalization / Custom Design",
    "Packing & Shipping",
    "Customer Service",
    "Social / Content",
    "Photography / Creative",
    "Inventory / Supplies",
    "Admin",
    "Wholesale / Partnerships",
    "Website / Shopify",
    "Events / Markets",
  ];

  const categories: { id: string; name: string }[] = [];
  for (let i = 0; i < categoryNames.length; i++) {
    const cat = await prisma.timeCategory.upsert({
      where: { name: categoryNames[i] },
      update: {},
      create: { name: categoryNames[i], isActive: true, sortOrder: i },
    });
    categories.push(cat);
  }

  // ─── Pay Periods ─────────────────────────────────────────────────────────────
  const today = new Date();
  const currentPeriodStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentPeriodEnd = addDays(currentPeriodStart, 13);

  const prevPeriodStart = addDays(currentPeriodStart, -14);
  const prevPeriodEnd = addDays(prevPeriodStart, 13);

  const openPeriod = await prisma.payPeriod.create({
    data: {
      startDate: currentPeriodStart,
      endDate: currentPeriodEnd,
      type: "BIWEEKLY",
      status: "OPEN",
    },
  });

  const closedPeriod = await prisma.payPeriod.create({
    data: {
      startDate: prevPeriodStart,
      endDate: prevPeriodEnd,
      type: "BIWEEKLY",
      status: "CLOSED",
    },
  });

  // ─── Employees ────────────────────────────────────────────────────────────────
  const emily = await prisma.employee.upsert({
    where: { email: "emily@emandmestudio.com" },
    update: {},
    create: {
      firstName: "Emily",
      lastName: "Anderson",
      preferredName: "Em",
      email: "emily@emandmestudio.com",
      phone: "555-0101",
      role: "ADMIN",
      jobTitle: "Studio Owner & Creative Director",
      department: "Leadership",
      startDate: new Date("2020-01-15"),
      birthMonth: 3,
      birthDay: 22,
      birthYear: 1990,
      status: "ACTIVE",
    },
  });

  const maya = await prisma.employee.upsert({
    where: { email: "maya@emandmestudio.com" },
    update: {},
    create: {
      firstName: "Maya",
      lastName: "Chen",
      email: "maya@emandmestudio.com",
      phone: "555-0102",
      role: "MANAGER",
      jobTitle: "Operations Manager",
      department: "Operations",
      managerId: emily.id,
      startDate: new Date("2021-03-01"),
      birthMonth: 7,
      birthDay: 14,
      status: "ACTIVE",
    },
  });

  const jordan = await prisma.employee.upsert({
    where: { email: "jordan@emandmestudio.com" },
    update: {},
    create: {
      firstName: "Jordan",
      lastName: "Kim",
      preferredName: "JK",
      email: "jordan@emandmestudio.com",
      phone: "555-0103",
      role: "STAFF",
      jobTitle: "Product Maker & Personalizer",
      department: "Production",
      managerId: maya.id,
      startDate: new Date("2022-06-15"),
      birthMonth: 11,
      birthDay: 5,
      status: "ACTIVE",
    },
  });

  const sofia = await prisma.employee.upsert({
    where: { email: "sofia@emandmestudio.com" },
    update: {},
    create: {
      firstName: "Sofia",
      lastName: "Torres",
      email: "sofia@emandmestudio.com",
      phone: "555-0104",
      role: "STAFF",
      jobTitle: "Content & Social Media",
      department: "Marketing",
      managerId: maya.id,
      startDate: new Date("2023-01-09"),
      birthMonth: 6,
      birthDay: 30,
      status: "ACTIVE",
    },
  });

  const alex = await prisma.employee.upsert({
    where: { email: "alex@emandmestudio.com" },
    update: {},
    create: {
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex@emandmestudio.com",
      role: "STAFF",
      jobTitle: "Shipping & Fulfillment",
      department: "Operations",
      managerId: maya.id,
      startDate: new Date("2023-08-21"),
      birthMonth: 2,
      birthDay: 18,
      status: "ACTIVE",
    },
  });

  // ─── Time Entries (this week) ─────────────────────────────────────────────────
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const makeEntry = (
    employeeId: string,
    categoryId: string,
    daysFromWeekStart: number,
    startHour: number,
    endHour: number,
    note: string,
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" = "DRAFT"
  ) => {
    const entryDate = addDays(weekStart, daysFromWeekStart);
    const start = setMinutes(setHours(entryDate, startHour), 0);
    const end = setMinutes(setHours(entryDate, endHour), 0);
    const duration = (endHour - startHour) * 60;

    return prisma.timeEntry.create({
      data: {
        employeeId,
        categoryId,
        payPeriodId: openPeriod.id,
        entryDate,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        note,
        source: daysFromWeekStart < 2 ? "TIMER" : "MANUAL",
        status,
      },
    });
  };

  // Jordan's entries this week
  await makeEntry(jordan.id, categories[0].id, 0, 9, 12, "Made 15 custom ornaments", "APPROVED");
  await makeEntry(jordan.id, categories[1].id, 0, 13, 17, "Personalized wedding gifts batch", "APPROVED");
  await makeEntry(jordan.id, categories[0].id, 1, 9, 13, "Laser cutting and assembly", "SUBMITTED");
  await makeEntry(jordan.id, categories[2].id, 1, 14, 17, "Packed and shipped 22 orders", "SUBMITTED");
  await makeEntry(jordan.id, categories[0].id, 2, 9, 12, "New product prototypes", "DRAFT");

  // Sofia's entries
  await makeEntry(sofia.id, categories[4].id, 0, 10, 14, "Instagram content batch - spring collection", "APPROVED");
  await makeEntry(sofia.id, categories[5].id, 1, 9, 13, "Product photography session", "SUBMITTED");
  await makeEntry(sofia.id, categories[4].id, 2, 10, 12, "TikTok videos editing", "DRAFT");

  // Alex's entries
  await makeEntry(alex.id, categories[2].id, 0, 8, 12, "Morning fulfillment run", "APPROVED");
  await makeEntry(alex.id, categories[2].id, 0, 13, 17, "Afternoon shipping", "APPROVED");
  await makeEntry(alex.id, categories[6].id, 1, 9, 11, "Inventory count and reorder", "SUBMITTED");
  await makeEntry(alex.id, categories[2].id, 1, 12, 17, "Large wholesale order fulfillment", "SUBMITTED");

  // Maya's entries
  await makeEntry(maya.id, categories[7].id, 0, 9, 12, "Weekly team check-ins", "APPROVED");
  await makeEntry(maya.id, categories[9].id, 1, 10, 14, "Shopify product listings update", "SUBMITTED");
  await makeEntry(maya.id, categories[8].id, 2, 9, 11, "Wholesale partner call", "DRAFT");

  // Emily's entries
  await makeEntry(emily.id, categories[7].id, 0, 9, 11, "Business planning", "APPROVED");
  await makeEntry(emily.id, categories[5].id, 1, 10, 14, "Brand photoshoot direction", "APPROVED");

  // ─── Active Timer for Jordan ──────────────────────────────────────────────────
  const existingTimer = await prisma.activeTimer.findUnique({
    where: { employeeId: jordan.id },
  });
  if (!existingTimer) {
    await prisma.activeTimer.create({
      data: {
        employeeId: jordan.id,
        categoryId: categories[0].id,
        startedAt: setMinutes(setHours(today, 9), 30),
        note: "Morning production run",
      },
    });
  }

  console.log("Seed complete!");
  console.log(`Created ${categories.length} categories, 5 employees, 1 open pay period, 1 closed pay period`);
  console.log("Active timer set for Jordan Kim");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

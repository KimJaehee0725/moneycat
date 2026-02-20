import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const shouldSeedDemo = process.env.SEED_DEMO === "true";

  if (!shouldSeedDemo) {
    console.log("Skipping demo seed. Set SEED_DEMO=true to create sample data.");
    return;
  }

  const email = process.env.DEMO_OWNER_EMAIL ?? "owner@example.com";
  const passwordHash = process.env.DEMO_OWNER_PASSWORD_HASH ?? "replace-this-hash";

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
    },
  });

  const household = await prisma.household.create({
    data: {
      name: "데모 가계부",
      ownerUserId: owner.id,
      members: {
        create: {
          userId: owner.id,
          role: "owner",
        },
      },
    },
  });

  await prisma.category.createMany({
    data: [
      { householdId: household.id, name: "월급", type: "income", isDefault: true },
      { householdId: household.id, name: "기타수입", type: "income", isDefault: true },
      { householdId: household.id, name: "식비", type: "expense", isDefault: true },
      { householdId: household.id, name: "교통", type: "expense", isDefault: true },
      { householdId: household.id, name: "생활", type: "expense", isDefault: true },
      { householdId: household.id, name: "데이트", type: "expense", isDefault: true },
    ],
    skipDuplicates: true,
  });

  console.log(`Demo seeded for household ${household.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

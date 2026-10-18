import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DemoTransaction = {
  type: "earn" | "redeem";
  points: number;
  reason: string;
  booking_id?: string;
};

type DemoAccount = {
  user_id: string;
  tier: "silver" | "gold" | "platinum";
  points_balance: number;
  transactions: DemoTransaction[];
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    user_id: "11111111-1111-4111-8111-111111111111",
    tier: "silver",
    points_balance: 450,
    transactions: [
      {
        type: "earn",
        points: 250,
        reason: "Estancia Hotel Centro - 2 noches",
        booking_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      },
      {
        type: "earn",
        points: 200,
        reason: "Estancia Hotel Norte - 1 noche",
        booking_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      },
    ],
  },
  {
    user_id: "22222222-2222-4222-8222-222222222222",
    tier: "gold",
    points_balance: 1850,
    transactions: [
      {
        type: "earn",
        points: 1200,
        reason: "Estancia Hotel Centro - 5 noches",
        booking_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      },
      {
        type: "earn",
        points: 650,
        reason: "Estancia Hotel Playa - 3 noches",
        booking_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      },
    ],
  },
  {
    user_id: "33333333-3333-4333-8333-333333333333",
    tier: "platinum",
    points_balance: 7300,
    transactions: [
      {
        type: "earn",
        points: 5000,
        reason: "Estancia Hotel Centro - 10 noches",
        booking_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      },
      {
        type: "earn",
        points: 2800,
        reason: "Estancia Hotel Playa - 7 noches",
        booking_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
      },
      {
        type: "redeem",
        points: 500,
        reason: "Canje: upgrade de habitación",
      },
    ],
  },
];

async function main() {
  console.log("Seeding loyalty demo accounts...");

  for (const demo of DEMO_ACCOUNTS) {
    await prisma.$transaction(async (tx) => {
      await tx.loyaltyAccount.upsert({
        where: { user_id: demo.user_id },
        update: { tier: demo.tier, points_balance: demo.points_balance },
        create: {
          user_id: demo.user_id,
          tier: demo.tier,
          points_balance: demo.points_balance,
        },
      });

      await tx.pointsTransaction.deleteMany({ where: { user_id: demo.user_id } });
      await tx.pointsTransaction.createMany({
        data: demo.transactions.map((transaction) => ({
          user_id: demo.user_id,
          ...transaction,
        })),
      });
    });

    console.log(
      `  ${demo.tier.padEnd(8)} ${demo.user_id}  ${demo.points_balance} pts`
    );
  }

  console.log("Loyalty seed completed.");
}

main()
  .catch((error) => {
    console.error("Loyalty seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

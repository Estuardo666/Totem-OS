import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, beforeEach, test } from "node:test";
import { prisma, resetDatabase } from "./prisma-test-db.mjs";

registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = new URL(`../../src/${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) url = new URL(specifier, context.parentURL);
  if (url?.protocol === "file:") {
    const path = fileURLToPath(url);
    for (const candidate of [path, `${path}.ts`, `${path}/index.ts`]) {
      if (existsSync(candidate) && candidate.endsWith(".ts")) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
} });

const { liquidateExpenseReimbursements } = await import("../../src/lib/finance-expense-service.ts");
const { updateInvoiceInDb } = await import("../../src/lib/finance-invoice-service.ts");

beforeEach(async () => {
  await resetDatabase();
  for (const id of ["reimb-ana", "reimb-luis"]) {
    await prisma.user.create({
      data: { id, name: id, email: `${id}@totem.test`, roleLegacy: "EDITOR", roleCode: "EDITOR" },
    });
  }
  await prisma.expense.createMany({
    data: [
      { id: "exp-ana-1", description: "Taxi", amount: 12.5, category: "TRANSPORTE", paidByUserId: "reimb-ana" },
      { id: "exp-ana-2", description: "Almuerzo", amount: 20, category: "COMIDA", paidByUserId: "reimb-ana" },
      { id: "exp-ana-old", description: "Ya devuelto", amount: 99, category: "OTROS", paidByUserId: "reimb-ana", reimbursed: true },
      { id: "exp-luis-1", description: "Software", amount: 30, category: "SOFTWARE", paidByUserId: "reimb-luis" },
      { id: "exp-company", description: "Pagado por la empresa", amount: 40, category: "OFICINA" },
    ],
  });
  await prisma.transaction.createMany({
    data: [
      { id: "tx-ana-pending", amount: 7.5, type: "EXPENSE", status: "PENDING", assignedToId: "reimb-ana" },
      { id: "tx-ana-paid", amount: 50, type: "EXPENSE", status: "PAID", assignedToId: "reimb-ana" },
      { id: "tx-ana-income", amount: 300, type: "INCOME", status: "PENDING", assignedToId: "reimb-ana" },
      { id: "tx-luis-pending", amount: 15, type: "EXPENSE", status: "PENDING", assignedToId: "reimb-luis" },
    ],
  });
});

const statusOf = async (id) => (await prisma.transaction.findUniqueOrThrow({ where: { id } })).status;

after(async () => {
  await prisma.$disconnect();
});

test("liquidating a user marks only that user's pending reimbursements", async () => {
  const result = await liquidateExpenseReimbursements(["reimb-ana"]);

  assert.deepEqual(result, { count: 3, totalAmount: 40 });
  const reimbursed = await prisma.expense.findMany({ where: { reimbursed: true }, orderBy: { id: "asc" }, select: { id: true } });
  assert.deepEqual(reimbursed.map((expense) => expense.id), ["exp-ana-1", "exp-ana-2", "exp-ana-old"]);
  assert.equal(await statusOf("tx-ana-pending"), "PAID");
  assert.equal(await statusOf("tx-ana-income"), "PENDING");
  assert.equal(await statusOf("tx-luis-pending"), "PENDING");
});

test("liquidation records no extra transaction, so cash is not counted twice", async () => {
  await liquidateExpenseReimbursements(["reimb-ana"]);
  assert.equal(await prisma.transaction.count(), 4);
});

test("liquidating with nothing pending is a no-op", async () => {
  assert.deepEqual(await liquidateExpenseReimbursements(["reimb-ana"]), { count: 3, totalAmount: 40 });
  assert.deepEqual(await liquidateExpenseReimbursements(["reimb-ana"]), { count: 0, totalAmount: 0 });
  assert.deepEqual(await liquidateExpenseReimbursements([]), { count: 0, totalAmount: 0 });
  assert.equal(await prisma.transaction.count(), 4);
  assert.equal(await prisma.expense.count({ where: { paidByUserId: "reimb-luis", reimbursed: false } }), 1);
});

test("editing an invoice to PAID records when it was collected, once", async () => {
  await prisma.client.create({ data: { id: "reimb-client", name: "Cliente" } });
  await prisma.invoice.create({ data: { id: "inv-1", amount: 100, status: "PENDING", clientId: "reimb-client" } });

  const paid = await updateInvoiceInDb("inv-1", { status: "PAID", id: "rewritten-id" });
  assert.equal(paid.id, "inv-1");
  assert.ok(paid.paidAt instanceof Date);

  const edited = await updateInvoiceInDb("inv-1", { status: "PAID", amount: 120 });
  assert.equal(edited.amount, 120);
  assert.equal(edited.paidAt.getTime(), paid.paidAt.getTime());
});

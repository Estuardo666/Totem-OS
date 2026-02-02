import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugFinancialData() {
  try {
    console.log("🔍 DIAGNÓSTICO DE DATOS FINANCIEROS");
    console.log("=====================================");

    // 1. Verificar todas las facturas
    console.log("\n📄 FACTURAS:");
    const allInvoices = await prisma.invoice.findMany({
      take: 10,
      orderBy: { generatedAt: 'desc' }
    });
    console.log(`Total facturas: ${allInvoices.length}`);
    allInvoices.forEach(invoice => {
      console.log(`- ${invoice.status}: $${invoice.amount} - ${invoice.generatedAt}`);
    });

    // 2. Verificar todas las transacciones
    console.log("\n💳 TRANSACCIONES:");
    const allTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log(`Total transacciones: ${allTransactions.length}`);
    allTransactions.forEach(transaction => {
      console.log(`- ${transaction.type}: ${transaction.status}: $${transaction.amount} - ${transaction.createdAt}`);
    });

    // 3. Verificar todos los gastos
    console.log("\n💰 GASTOS:");
    const allExpenses = await prisma.expense.findMany({
      take: 10,
      orderBy: { date: 'desc' }
    });
    console.log(`Total gastos: ${allExpenses.length}`);
    allExpenses.forEach(expense => {
      console.log(`- $${expense.amount} - Reembolsado: ${expense.reimbursed} - ${expense.date}`);
    });

    // 4. Verificar datos del mes actual
    console.log("\n📅 DATOS MES ACTUAL:");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`Período: ${monthStart.toISOString()} a ${monthEnd.toISOString()}`);

    const currentMonthInvoices = await prisma.invoice.findMany({
      where: {
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const currentMonthTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const currentMonthExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    console.log(`Facturas mes actual: ${currentMonthInvoices.length}`);
    console.log(`Transacciones mes actual: ${currentMonthTransactions.length}`);
    console.log(`Gastos mes actual: ${currentMonthExpenses.length}`);

    // 5. Verificar status únicos
    console.log("\n🏷️ STATUS ENCONTRADOS:");
    
    const invoiceStatuses = [...new Set(allInvoices.map(i => i.status))];
    const transactionStatuses = [...new Set(allTransactions.map(t => t.status))];
    const transactionTypes = [...new Set(allTransactions.map(t => t.type))];
    
    console.log(`Status facturas: ${invoiceStatuses.join(', ')}`);
    console.log(`Status transacciones: ${transactionStatuses.join(', ')}`);
    console.log(`Tipos transacciones: ${transactionTypes.join(', ')}`);

    // 6. Calcular totales reales
    console.log("\n💰 CÁLCULOS REALES:");
    
    const totalIncome = currentMonthInvoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + i.amount, 0) +
      currentMonthTransactions
        .filter(t => t.status === 'PAID' && t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = currentMonthExpenses
      .filter(e => e.reimbursed === true)
      .reduce((sum, e) => sum + e.amount, 0) +
      currentMonthTransactions
        .filter(t => t.status === 'PAID' && t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    console.log(`Ingresos (PAID): $${totalIncome}`);
    console.log(`Gastos (PAID/reembolsado): $${totalExpenses}`);
    console.log(`Utilidad neta: $${totalIncome - totalExpenses}`);

  } catch (error) {
    console.error("❌ Error en diagnóstico:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFinancialData();

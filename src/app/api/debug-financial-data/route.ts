import { NextResponse } from 'next/server';
import { getFinancialStats } from '@/actions/finance-actions';

export async function GET() {
  try {
    console.log("🔍 DIAGNÓSTICO DE API DE DASHBOARD");
    console.log("=====================================");

    // Llamar a la función exacta que usa el dashboard
    console.log("\n📊 Llamando a getFinancialStats()...");
    const result = await getFinancialStats();
    
    console.log("✅ Resultado de getFinancialStats():");
    console.log(JSON.stringify(result, null, 2));

    // Verificar si hay datos en el resultado
    if (result.success && result.data) {
      const stats = result.data;
      console.log("\n💰 Análisis de datos recibidos:");
      console.log(`- Ingresos totales: $${stats.totalIncome}`);
      console.log(`- Gastos totales: $${stats.totalExpenses}`);
      console.log(`- Utilidad neta: $${stats.netProfit}`);
      console.log(`- Transacciones recientes: ${stats.recentTransactions?.length || 0}`);
      
      // Verificar si los valores son 0
      const isAllZero = stats.totalIncome === 0 && stats.totalExpenses === 0 && stats.netProfit === 0;
      console.log(`\n🎯 ¿Todos los valores son 0? ${isAllZero ? 'SÍ' : 'NO'}`);
      
      if (isAllZero) {
        console.log("\n⚠️ INVESTIGANDO POR QUÉ TODO ES 0:");
        
        // Verificar transacciones recientes
        if (stats.recentTransactions && stats.recentTransactions.length > 0) {
          console.log("📋 Transacciones recientes encontradas:");
          stats.recentTransactions.forEach((tx, index) => {
            console.log(`  ${index + 1}. ${tx.type}: $${tx.amount} - ${tx.description}`);
          });
        } else {
          console.log("❌ No hay transacciones recientes");
        }
        
        // Verificar si hay un problema de parseo
        console.log("\n🔍 Verificando tipos de datos:");
        console.log(`- totalIncome tipo: ${typeof stats.totalIncome}`);
        console.log(`- totalExpenses tipo: ${typeof stats.totalExpenses}`);
        console.log(`- netProfit tipo: ${typeof stats.netProfit}`);
        console.log(`- ¿Son números? ${!isNaN(stats.totalIncome) && !isNaN(stats.totalExpenses) && !isNaN(stats.netProfit)}`);
      }
    } else {
      console.log("\n❌ Error en la respuesta de la API:");
      console.log(result);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      diagnostics: {
        allZero: result.success && result.data ? 
          (result.data.totalIncome === 0 && result.data.totalExpenses === 0 && result.data.netProfit === 0) : 
          'unknown',
        hasTransactions: result.success && result.data ? 
          (result.data.recentTransactions?.length || 0) > 0 : 
          false
      }
    });

  } catch (error) {
    console.error("\n💥 Error al diagnosticar API:");
    console.error(error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

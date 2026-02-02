import { NextRequest, NextResponse } from "next/server";
import { createMonthlyPaymentTransactions } from "@/lib/finance-logic";

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return expected === headerSecret || expected === querySecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await createMonthlyPaymentTransactions();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

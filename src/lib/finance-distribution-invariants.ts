export interface ProfitShareInput {
  userId: string;
  percent: number;
}

export interface CalculatedProfitShare extends ProfitShareInput {
  amount: number;
}

/**
 * Calcula el reparto en centavos y asigna cualquier residuo de redondeo por
 * mayor resto. El resultado siempre suma exactamente el monto distribuible.
 */
export function calculateProfitShares(
  distributableAmount: number,
  shares: ProfitShareInput[]
): CalculatedProfitShare[] {
  if (!Number.isFinite(distributableAmount) || distributableAmount < 0) {
    throw new Error("El monto distribuible debe ser un numero valido mayor o igual a 0");
  }
  if (shares.length === 0) {
    throw new Error("Debe existir al menos un socio elegible");
  }

  const userIds = new Set<string>();
  for (const share of shares) {
    if (userIds.has(share.userId)) {
      throw new Error(`El usuario ${share.userId} aparece mas de una vez en el reparto`);
    }
    userIds.add(share.userId);

    if (!Number.isFinite(share.percent) || share.percent <= 0 || share.percent > 100) {
      throw new Error(`Porcentaje invalido para el usuario ${share.userId}`);
    }
  }

  const totalPercent = shares.reduce((sum, share) => sum + share.percent, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(
      `La suma de porcentajes debe ser 100% (actual: ${totalPercent.toFixed(2)}%)`
    );
  }

  const totalCents = Math.round(distributableAmount * 100);
  const allocations = shares.map((share, index) => {
    const exactCents = totalCents * (share.percent / totalPercent);
    const cents = Math.floor(exactCents);
    return { ...share, index, cents, remainder: exactCents - cents };
  });

  const remainingCents = totalCents - allocations.reduce((sum, item) => sum + item.cents, 0);
  const remainderOrder = [...allocations].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  );
  for (let index = 0; index < remainingCents; index += 1) {
    remainderOrder[index % remainderOrder.length].cents += 1;
  }

  return allocations
    .sort((a, b) => a.index - b.index)
    .map(({ userId, percent, cents }) => ({ userId, percent, amount: cents / 100 }));
}

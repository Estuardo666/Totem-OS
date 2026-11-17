-- Fecha real de cobro (caja) de una transacción, independiente de createdAt
-- (mes al que corresponde / devengado).
-- Aditivo: columna nullable, no altera datos existentes.
ALTER TABLE "Transaction" ADD COLUMN "paidAt" TIMESTAMP(3);

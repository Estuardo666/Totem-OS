-- Fecha real de cobro (caja), independiente de generatedAt (devengado).
-- Aditivo: columna nullable, no altera datos existentes.
ALTER TABLE "Invoice" ADD COLUMN "paidAt" TIMESTAMP(3);

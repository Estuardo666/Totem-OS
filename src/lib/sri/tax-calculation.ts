import { PORCENTAJES_IVA } from "./types";

export const sriMoney = (value: number) => Number(value.toFixed(2));

export function calcularLineaSri(item: { cantidad: number; precioUnitario: number; descuento?: number; tipoIva: string }) {
  const discount = item.descuento ?? 0;
  if (![item.cantidad, item.precioUnitario, discount].every(Number.isFinite) || item.cantidad <= 0 || item.precioUnitario < 0 || discount < 0 || discount > item.cantidad * item.precioUnitario) throw new Error("Importes de la línea inválidos");
  if (!Object.prototype.hasOwnProperty.call(PORCENTAJES_IVA, item.tipoIva)) throw new Error("Código IVA no soportado");
  const tarifa = PORCENTAJES_IVA[item.tipoIva];
  const precioTotalSinImpuesto = sriMoney(item.cantidad * item.precioUnitario - discount);
  return { descuento: discount, precioTotalSinImpuesto, tarifa, valorImpuesto: sriMoney(precioTotalSinImpuesto * tarifa / 100) };
}

export function agruparImpuestosSri(items: Array<{ codigoImpuesto: string; codigoPorcentaje: string; baseImponible: number; valorImpuesto: number }>) {
  const groups = new Map<string, { codigo: string; codigoPorcentaje: string; baseImponible: number; valor: number }>();
  for (const item of items) {
    const key = `${item.codigoImpuesto}:${item.codigoPorcentaje}`;
    const total = groups.get(key) ?? { codigo: item.codigoImpuesto, codigoPorcentaje: item.codigoPorcentaje, baseImponible: 0, valor: 0 };
    total.baseImponible = sriMoney(total.baseImponible + item.baseImponible);
    total.valor = sriMoney(total.valor + item.valorImpuesto);
    groups.set(key, total);
  }
  return [...groups.values()];
}

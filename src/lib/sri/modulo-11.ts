// Algoritmo Módulo 11 para dígito verificador de clave de acceso SRI
// Basado en la ficha técnica del SRI Ecuador

/**
 * Calcula el dígito verificador usando Módulo 11.
 * El SRI usa una variante donde el dígito verificador debe ser 0-9.
 * Si el resultado es 10 → dígito = 0, si es 11 → dígito = 1
 */
export function calcularModulo11(cadena: string): number {
  let suma = 0;
  let peso = 2;

  // Recorrer de derecha a izquierda
  for (let i = cadena.length - 1; i >= 0; i--) {
    const digito = parseInt(cadena[i], 10);
    if (isNaN(digito)) {
      throw new Error(`Carácter no numérico en clave de acceso: ${cadena[i]}`);
    }
    suma += digito * peso;
    peso++;
    if (peso > 7) {
      peso = 2;
    }
  }

  const residuo = suma % 11;
  const digitoVerificador = 11 - residuo;

  if (digitoVerificador === 11) return 0;
  if (digitoVerificador === 10) return 1;
  return digitoVerificador;
}

/**
 * Valida que una clave de acceso de 49 dígitos tenga el dígito verificador correcto.
 */
export function validarClaveAcceso(clave: string): boolean {
  if (clave.length !== 49) return false;
  if (!/^\d{49}$/.test(clave)) return false;

  const base = clave.substring(0, 48);
  const digitoEsperado = parseInt(clave[48], 10);
  const digitoCalculado = calcularModulo11(base);

  return digitoEsperado === digitoCalculado;
}

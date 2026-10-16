/**
 * Convierte números dichos en palabras (como los transcribe la voz) a cifras
 * para mostrarlos en pantalla: "dos mil setenta y cinco dólares" → "$2,075",
 * "un dólar con sesenta y un centavos" → "$1.61", "quince por ciento" → "15%".
 */

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

const strip = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lee una secuencia de palabras numéricas desde `i`; devuelve valor y palabras usadas. */
function readNumber(words: string[], i: number): { value: number; used: number } | null {
  let total = 0;
  let current = 0;
  let used = 0;
  let any = false;
  for (let j = i; j < words.length; j++) {
    const w = strip(words[j]);
    if (w in UNITS) {
      const v = UNITS[w];
      const afterY = j > i && strip(words[j - 1]) === "y";
      // Solo se suma lo que encaja: "ciento veinte", "treinta y dos"; no "un quince".
      const fits = current === 0 || (v < 100 && current % 100 === 0) || (afterY && v < 10 && current % 10 === 0);
      if (!fits) break;
      current += v;
      any = true;
      used = j - i + 1;
    } else if (w === "mil" && (any || total === 0)) {
      total += (current || 1) * 1000;
      current = 0;
      any = true;
      used = j - i + 1;
    } else if ((w === "millon" || w === "millones") && any) {
      total = (total + current) * 1_000_000;
      current = 0;
      used = j - i + 1;
    } else if (w === "y" && any && j + 1 < words.length && strip(words[j + 1]) in UNITS) {
      continue;
    } else {
      break;
    }
  }
  if (!any) return null;
  // "un" o "una" sueltos suelen ser artículos ("un cliente"), no cifras.
  const single = used === 1 ? strip(words[i]) : null;
  if (single === "un" || single === "una" || single === "uno") return null;
  return { value: total + current, used };
}

const money = (n: number, cents?: number) =>
  `$${n.toLocaleString("en-US")}${cents !== undefined ? `.${String(cents).padStart(2, "0")}` : ""}`;

export function spokenNumbersToDigits(text: string): string {
  // Conserva la puntuación pegada a cada palabra.
  const tokens = text.split(/(\s+)/);
  const words: string[] = [];
  const index: number[] = [];
  tokens.forEach((t, k) => {
    if (t.trim()) {
      words.push(t.replace(/[.,;:!?¿¡)]+$/, "").replace(/^[(¿¡]+/, ""));
      index.push(k);
    }
  });

  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const num = readNumber(words, i);
    // "un dólar" sí es una cifra cuando le sigue la moneda.
    const unitMoney = !num && /^(un|uno)$/i.test(words[i]) && /^d[oó]lar/i.test(words[i + 1] ?? "") ? { value: 1, used: 1 } : null;
    const n = num ?? unitMoney;
    if (!n) {
      out.push(tokens[index[i]], tokens[index[i] + 1] ?? "");
      i++;
      continue;
    }
    let end = i + n.used;
    let rendered = n.value.toLocaleString("en-US");
    const next = strip(words[end] ?? "");
    if (/^dolar(es)?$/.test(next)) {
      end++;
      // "… dólares con sesenta centavos"
      if (strip(words[end] ?? "") === "con") {
        const cents = readNumber(words, end + 1) ?? (/^(un|uno)$/i.test(words[end + 1] ?? "") ? { value: 1, used: 1 } : null);
        if (cents && cents.value < 100 && /^centavos?$/.test(strip(words[end + 1 + cents.used] ?? ""))) {
          rendered = money(n.value, cents.value);
          end += 2 + cents.used;
        } else {
          rendered = money(n.value);
        }
      } else {
        rendered = money(n.value);
      }
    } else if (next === "por" && strip(words[end + 1] ?? "") === "ciento") {
      rendered = `${n.value}%`;
      end += 2;
    }
    // Mantiene la puntuación final del último token consumido.
    const tail = tokens[index[end - 1]].match(/[.,;:!?)]+$/)?.[0] ?? "";
    out.push(rendered + tail, tokens[index[end - 1] + 1] ?? "");
    i = end;
  }
  return tokens[0] === "" || !tokens[0]?.trim() ? (tokens[0] ?? "") + out.join("") : out.join("");
}

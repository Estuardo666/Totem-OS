/**
 * Búsqueda tolerante de nombres para el asistente: ignora mayúsculas, tildes y
 * signos, y acepta errores de transcripción ("Audisense" → "Audisens",
 * "arevalo moda" → "Arévalo Moda Masculina").
 */

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Cómo suena una palabra en español: une letras que se pronuncian igual
 * ("EUROpeek" ≈ "europic", "Amaca" ≈ "amaka", "Muñoz" ≈ "munos").
 */
function sound(word: string): string {
  return word
    .replace(/ph/g, "f")
    .replace(/ee|y/g, "i")
    .replace(/oo/g, "u")
    .replace(/qu|q|c(?=[aou])|ck/g, "k")
    .replace(/c(?=[ei])|z/g, "s")
    .replace(/v/g, "b")
    .replace(/ñ/g, "n")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
}

const rawSim = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/** Similitud 0..1 entre dos palabras, por escritura o por sonido. */
const wordSim = (a: string, b: string) => Math.max(rawSim(a, b), rawSim(sound(a), sound(b)) * 0.97);

/**
 * Puntaje 0..1 de qué tan bien `query` describe `name`. 1 = coincidencia
 * exacta o contenida; cada palabra de la búsqueda se compara con la palabra
 * más parecida del nombre.
 */
export function nameScore(query: string, name: string): number {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (!q) return 0;
  if (n === q) return 1;
  if (n.includes(q)) return 0.95;
  const compactQ = q.replace(/ /g, "");
  const compactN = n.replace(/ /g, "");
  if (compactN.includes(compactQ)) return 0.92;

  const qWords = q.split(" ");
  const nWords = n.split(" ");
  const perWord = qWords.map((w) =>
    Math.max(...nWords.map((nw) => (nw.startsWith(w) && w.length >= 3 ? 0.95 : wordSim(w, nw))))
  );
  const avg = perWord.reduce((s, v) => s + v, 0) / perWord.length;
  // También el nombre completo contra la búsqueda completa (p. ej. palabras pegadas).
  return Math.max(avg, wordSim(compactQ, compactN));
}

/** Mejores coincidencias por encima del umbral, ordenadas de mejor a peor. */
export function fuzzyMatch<T extends { name: string }>(query: string, rows: T[], threshold = 0.72): (T & { score: number })[] {
  return rows
    .map((r) => ({ ...r, score: nameScore(query, r.name) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export type PromotionFeature = "AI" | "APPROVAL";
export type PromotionSample = { answer: string | null; edited: boolean };

/** One rejection or correction resets eligibility for the entire 14-day window. */
export function meetsPromotionCriteria(samples: PromotionSample[]): boolean {
  return samples.length >= 5 && samples.every((sample) => sample.answer === "1" && !sample.edited);
}

/** P(X = k) for a Poisson distribution with mean `mean`. */
export function poisson_probability(mean: number, k: number): number {
  if (mean <= 0) {
    return k === 0 ? 1 : 0;
  }
  let probability = Math.exp(-mean);
  for (let index = 1; index <= k; index += 1) {
    probability *= mean / index;
  }
  return probability;
}

/** P(X = 0..max), renormalised so the list sums to 1 (the cut tail is tiny). */
export function poisson_distribution(mean: number, max: number): number[] {
  const probabilities = Array.from({ length: max + 1 }, (_, k) => poisson_probability(mean, k));
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  return probabilities.map((probability) => probability / total);
}

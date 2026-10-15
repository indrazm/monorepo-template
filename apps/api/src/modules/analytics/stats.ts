// ---------------------------------------------------------------------------
// The small amount of statistics an A/B readout needs (FR-ANL-04). Without
// this, two CTRs are just two numbers and every random fluctuation looks like
// a winner.
// ---------------------------------------------------------------------------

// Below this many views per arm, a result is noise regardless of the p-value.
export const MIN_SAMPLE_PER_ARM = 100;
export const SIGNIFICANCE_LEVEL = 0.05;

// Wilson score interval — behaves sensibly at small samples and at rates near
// 0 or 1, where the normal approximation does not.
export function wilsonInterval(
  successes: number,
  trials: number,
  z = 1.96,
): { low: number; high: number } {
  if (trials <= 0) return { low: 0, high: 0 };
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return {
    low: Math.max(0, (center - margin) / denominator),
    high: Math.min(1, (center + margin) / denominator),
  };
}

// Standard normal CDF via the Abramowitz & Stegun erf approximation; accurate
// to ~1e-7, which is far more than a p-value readout needs.
function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

// Two-sided two-proportion z-test. Returns null when either arm has no data,
// since there is nothing to compare.
export function twoProportionPValue(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number,
): number | null {
  if (trialsA <= 0 || trialsB <= 0) return null;
  const pA = successesA / trialsA;
  const pB = successesB / trialsB;
  const pooled = (successesA + successesB) / (trialsA + trialsB);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / trialsA + 1 / trialsB));
  if (standardError === 0) return 1;
  const z = (pA - pB) / standardError;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

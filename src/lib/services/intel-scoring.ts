import { FOOD_INDICATORS, FOOD_BLOCKLIST } from "@/lib/constants";

export interface PinScoreInput {
  saves: number;
  velocity: number;
  instantVelocity: number;
  acceleration: number;
  baselineMultiple: number;
  pinCreatedAt: Date | string | null;
  creatorFollowers?: number;
  title: string;
  description: string;
}

export interface PinScoreResult {
  score: number;
  tier: string;
  tierColor: string;
}

const TIERS = [
  { min: 85, tier: "Must Write", color: "emerald" },
  { min: 65, tier: "Strong", color: "blue" },
  { min: 45, tier: "Promising", color: "amber" },
  { min: 25, tier: "Watch", color: "yellow" },
  { min: 0, tier: "Low Priority", color: "muted" },
] as const;

function getDaysOld(pinCreatedAt: Date | string | null): number {
  if (!pinCreatedAt) return 60;
  const ms = Date.now() - new Date(pinCreatedAt).getTime();
  return Math.max(0, ms / 86_400_000);
}

function isFoodRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  if (FOOD_BLOCKLIST.some((blocked) => lower.includes(blocked))) return false;
  return FOOD_INDICATORS.some((indicator) => lower.includes(indicator));
}

export function computePinScore(pin: PinScoreInput): PinScoreResult {
  const hasNewFields =
    pin.instantVelocity !== 0 || pin.acceleration !== 0 || pin.baselineMultiple !== 0;

  // === ENGAGEMENT GATE ===
  // Pins need a minimum level of engagement to score well.
  // This prevents brand-new pins with 1-2 saves from ranking as "Promising."
  const minSavesForRelevance = 10;
  const engagementFactor = Math.min(1, pin.saves / minSavesForRelevance);
  // Pins with <10 saves get their score scaled down proportionally.
  // 1 save = 10% of score, 5 saves = 50%, 10+ saves = full score.

  // --- Velocity (30%): the core signal ---
  // Use instantVelocity if available, otherwise lifetime velocity
  let velocityNorm: number;
  if (hasNewFields && pin.instantVelocity > 0) {
    velocityNorm = Math.min(1, pin.instantVelocity / 100);
  } else {
    velocityNorm = Math.min(1, pin.velocity / 100);
  }

  // --- Acceleration (20%): is it speeding up? ---
  let accelNorm: number;
  if (!hasNewFields) {
    accelNorm = 0; // no data = no score (not neutral)
  } else {
    accelNorm =
      pin.acceleration > 0
        ? Math.min(1, Math.log10(pin.acceleration + 1) / 2)
        : 0;
  }

  // --- Engagement (20%): total saves on log scale ---
  // This is the proof that a pin is actually resonating.
  const engagementNorm = Math.min(1, Math.log10(pin.saves + 1) / 4);

  // --- Freshness (15%): exponential decay, 7-day half-life ---
  // Freshness is a BONUS for recent pins, not a standalone score.
  // It's gated by engagement — a fresh pin with 0 saves gets nothing.
  const daysOld = getDaysOld(pin.pinCreatedAt);
  const freshnessNorm = Math.exp(-0.693 * daysOld / 7);

  // --- Baseline Multiple (10%): outperforming creator's average? ---
  // baselineMultiple is stored as integer×10 in DB (2.5x = 25), so divide by 10
  let baselineNorm: number;
  if (!hasNewFields) {
    baselineNorm = 0; // no data = no score
  } else {
    const realMultiple = pin.baselineMultiple / 10;
    baselineNorm = Math.min(1, Math.max(0, realMultiple - 1) / 2);
  }

  // --- Content Relevance (5%): food relevance + has title ---
  let contentScore = 0;
  if (pin.title && pin.title.trim().length > 0) contentScore += 0.33;
  if (pin.description && pin.description.trim().length > 20) contentScore += 0.33;
  if (pin.title && isFoodRelevant(pin.title)) contentScore += 0.34;

  // Compute raw score
  const rawBeforeGate =
    velocityNorm * 30 +
    accelNorm * 20 +
    engagementNorm * 20 +
    freshnessNorm * 15 +
    baselineNorm * 10 +
    contentScore * 5;

  // Apply engagement gate: scale down the score for low-save pins
  // Content relevance (5%) is NOT gated — that's just metadata quality
  const gatedPortion =
    velocityNorm * 30 +
    accelNorm * 20 +
    engagementNorm * 20 +
    freshnessNorm * 15 +
    baselineNorm * 10;

  const ungatedPortion = contentScore * 5;

  const raw = gatedPortion * engagementFactor + ungatedPortion;

  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const { tier, color: tierColor } =
    TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];

  return { score, tier, tierColor };
}

/**
 * RiskEngine — unified eye-strain risk intelligence
 *
 * Fuses signals from BlinkDetector (camera) and BehaviorSensor (behavior)
 * into a single risk score with adaptive thresholds and time decay.
 *
 * Signal priority:
 *   1. Camera (blinksPerMinute) — most accurate
 *   2. blinkGapSeconds         — early-warning override
 *   3. Behavior fallback       — sessionMinutes when camera unavailable
 *
 * Risk pipeline:
 *   baseRisk
 *     × appCategoryMultiplier
 *     × timeOfDayMultiplier
 *     × timeDecayFactor         (0.7 after 3+ min inactivity)
 *   = finalRisk  →  riskLevel  →  shouldIntervene (vs. adaptive threshold)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export interface BlinkInput {
  blinksPerMinute: number;       // from BlinkDetector (camera)
  blinkGapSeconds: number;       // seconds since last blink
  isCalibrated: boolean;
}

export interface BehaviorInput {
  sessionMinutes: number;
  appCategoryMultiplier: number; // e.g. 1.5 for social_media
  timeOfDayMultiplier: number;   // 1.3 for 21:00–02:00, else 1.0
  lastActivityTimestamp?: number; // ms — used for time-decay
}

export interface RiskEngineResult {
  riskLevel: RiskLevel;
  riskScore: number;             // 0–1 (clamped)
  baseRisk: number;              // before multipliers
  recommendation: string;
  shouldIntervene: boolean;
  interventionThreshold: number; // current adaptive threshold
  signalSource: 'camera' | 'behavior_fallback';
  breakdown: RiskBreakdown;
}

export interface RiskBreakdown {
  baseRisk: number;
  afterCategory: number;
  afterTimeOfDay: number;
  afterDecay: number;
  finalRisk: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THRESHOLDS_STORAGE_KEY = 'blinkwell_thresholds';

/** Default threshold at which an intervention is triggered. */
const DEFAULT_INTERVENTION_THRESHOLD = 0.3;

/** Bump applied to threshold per 3 consecutive ignored alerts. */
const THRESHOLD_BUMP = 0.10;

/** Max threshold so we don't suppress high-risk alerts forever. */
const MAX_INTERVENTION_THRESHOLD = 0.65;

/** Inactivity gap (ms) after which 30% time-decay kicks in. */
const DECAY_INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

/** How long to suppress re-intervention after an alert is shown (ms). */
const INTERVENTION_COOLDOWN_MS = 90_000; // 90 seconds

interface PersistedThresholds {
  interventionThreshold: number;
  consecutiveIgnores: number;
}

// ─── Pure risk functions ──────────────────────────────────────────────────────

/**
 * Derive base risk from camera blink rate (0–1).
 * blinkGap overrides if it signals higher risk.
 */
function baseRiskFromCamera(blinksPerMinute: number, blinkGapSeconds: number): number {
  // blinkGap > 15s is a strong immediate signal regardless of rolling rate
  if (blinkGapSeconds > 15) return 0.8;

  if (blinksPerMinute >= 12) return 0.1;
  if (blinksPerMinute >= 6)  return 0.4;
  return 0.8;
}

/**
 * Derive base risk from session duration when camera is unavailable.
 */
function baseRiskFromSession(sessionMinutes: number): number {
  if (sessionMinutes < 15) return 0.1;
  if (sessionMinutes < 30) return 0.4;
  return 0.8;
}

/**
 * Apply time-decay: if user has been inactive for 3+ minutes, reduce risk by 30%.
 */
function applyTimeDecay(risk: number, lastActivityTimestamp: number | undefined): number {
  if (!lastActivityTimestamp) return risk;
  const inactiveMs = Date.now() - lastActivityTimestamp;
  return inactiveMs >= DECAY_INACTIVITY_MS ? risk * 0.7 : risk;
}

function toRiskLevel(score: number): RiskLevel {
  if (score < 0.3) return 'low';
  if (score < 0.6) return 'medium';  // 0.3 ≤ score < 0.6
  return 'high';
}

/**
 * Generate a context-aware recommendation string.
 */
function buildRecommendation(
  level: RiskLevel,
  source: 'camera' | 'behavior_fallback',
  blink: BlinkInput | null,
  behavior: BehaviorInput
): string {
  if (level === 'low') {
    return 'Your eyes are healthy. Keep it up! 👁️';
  }

  const nightSuffix = behavior.timeOfDayMultiplier > 1
    ? ' Night screen use amplifies strain — consider reducing brightness.'
    : '';

  const categoryMap: Record<number, string> = {
    1.5: 'Social media scrolling causes rapid, small eye movements.',
    1.2: 'Video watching reduces your blink rate significantly.',
    1.0: 'Reading is moderately taxing on your eyes.',
    0.2: 'Audio mode is easy on your eyes.',
  };
  const categorySuffix = categoryMap[behavior.appCategoryMultiplier] ?? '';

  if (source === 'camera' && blink) {
    if (blink.blinkGapSeconds > 15) {
      return `You haven't blinked in ${Math.round(blink.blinkGapSeconds)}s. Blink now to re-lubricate your eyes.${nightSuffix}`;
    }
    if (blink.blinksPerMinute < 6) {
      return `Blink rate critically low (${blink.blinksPerMinute}/min). Normal is 15–20/min. ${categorySuffix}${nightSuffix}`;
    }
    return `Blink rate below normal (${blink.blinksPerMinute}/min). Try slow, deliberate blinking.${nightSuffix}`;
  }

  // Behavior fallback
  if (behavior.sessionMinutes >= 30) {
    return `You've been on screen for ${Math.round(behavior.sessionMinutes)} minutes. Take a 20-20-20 break now.${nightSuffix}`;
  }
  return `${Math.round(behavior.sessionMinutes)} minutes of screen time. ${categorySuffix}${nightSuffix}`;
}

// ─── RiskEngine class ─────────────────────────────────────────────────────────

export class RiskEngine {
  private interventionThreshold = DEFAULT_INTERVENTION_THRESHOLD;
  private consecutiveIgnores = 0;
  private lastInterventionShownAt = 0;
  private loaded = false;

  // ── Persistence ────────────────────────────────────────────────────────────

  async loadThresholds(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(THRESHOLDS_STORAGE_KEY);
      if (raw) {
        const saved: PersistedThresholds = JSON.parse(raw);
        this.interventionThreshold = saved.interventionThreshold;
        this.consecutiveIgnores = saved.consecutiveIgnores;
      }
    } catch {}
    this.loaded = true;
  }

  private async persistThresholds(): Promise<void> {
    try {
      const data: PersistedThresholds = {
        interventionThreshold: this.interventionThreshold,
        consecutiveIgnores: this.consecutiveIgnores,
      };
      await AsyncStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  // ── Adaptive learning ──────────────────────────────────────────────────────

  /**
   * Call when user dismisses/ignores an alert without acting.
   * Every 3 consecutive ignores → raise intervention threshold by 10%.
   */
  recordIgnored(): void {
    this.consecutiveIgnores++;
    if (this.consecutiveIgnores % 3 === 0) {
      this.interventionThreshold = Math.min(
        this.interventionThreshold + THRESHOLD_BUMP,
        MAX_INTERVENTION_THRESHOLD
      );
    }
    this.persistThresholds();
  }

  /**
   * Call when user accepts / acts on an alert.
   * Resets consecutive-ignore counter and slightly lowers threshold back toward default.
   */
  recordAccepted(): void {
    this.consecutiveIgnores = 0;
    // Slowly drift back toward default (but never below it)
    this.interventionThreshold = Math.max(
      DEFAULT_INTERVENTION_THRESHOLD,
      this.interventionThreshold - THRESHOLD_BUMP / 2
    );
    this.persistThresholds();
  }

  // ── Core computation ───────────────────────────────────────────────────────

  compute(
    blink: BlinkInput | null,
    behavior: BehaviorInput
  ): RiskEngineResult {
    // 1. Base risk
    const useCameraSignal =
      blink !== null && blink.isCalibrated && blink.blinksPerMinute >= 0;

    const source: 'camera' | 'behavior_fallback' = useCameraSignal
      ? 'camera'
      : 'behavior_fallback';

    const baseRisk = useCameraSignal
      ? baseRiskFromCamera(blink!.blinksPerMinute, blink!.blinkGapSeconds)
      : baseRiskFromSession(behavior.sessionMinutes);

    // 2. Apply multipliers
    const afterCategory = baseRisk * behavior.appCategoryMultiplier;
    const afterTimeOfDay = afterCategory * behavior.timeOfDayMultiplier;

    // 3. Time decay
    const afterDecay = applyTimeDecay(afterTimeOfDay, behavior.lastActivityTimestamp);

    // 4. Clamp
    const finalRisk = Math.min(1, Math.max(0, afterDecay));

    const riskLevel = toRiskLevel(finalRisk);

    // 5. Intervention gate: check cooldown and adaptive threshold
    const now = Date.now();
    const cooldownExpired =
      now - this.lastInterventionShownAt > INTERVENTION_COOLDOWN_MS;
    const shouldIntervene =
      finalRisk >= this.interventionThreshold && cooldownExpired;

    if (shouldIntervene) {
      this.lastInterventionShownAt = now;
    }

    const recommendation = buildRecommendation(riskLevel, source, blink, behavior);

    return {
      riskLevel,
      riskScore: Math.round(finalRisk * 1000) / 1000,
      baseRisk,
      recommendation,
      shouldIntervene,
      interventionThreshold: this.interventionThreshold,
      signalSource: source,
      breakdown: {
        baseRisk,
        afterCategory,
        afterTimeOfDay,
        afterDecay,
        finalRisk,
      },
    };
  }

  // Allow callers to query current adaptive threshold without computing
  getInterventionThreshold(): number {
    return this.interventionThreshold;
  }

  getConsecutiveIgnores(): number {
    return this.consecutiveIgnores;
  }
}

// Singleton
export const riskEngine = new RiskEngine();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRiskEngine(
  blinkData: BlinkInput | null,
  behaviorData: BehaviorInput
): RiskEngineResult & {
  recordIgnored: () => void;
  recordAccepted: () => void;
} {
  const [result, setResult] = useState<RiskEngineResult>(() =>
    riskEngine.compute(blinkData, behaviorData)
  );

  // Load persisted thresholds once on mount
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    riskEngine.loadThresholds().then(() => {
      setResult(riskEngine.compute(blinkData, behaviorData));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute whenever inputs change
  useEffect(() => {
    setResult(riskEngine.compute(blinkData, behaviorData));
  }, [
    blinkData?.blinksPerMinute,
    blinkData?.blinkGapSeconds,
    blinkData?.isCalibrated,
    behaviorData.sessionMinutes,
    behaviorData.appCategoryMultiplier,
    behaviorData.timeOfDayMultiplier,
    behaviorData.lastActivityTimestamp,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordIgnored = useCallback(() => {
    riskEngine.recordIgnored();
    // Recompute — threshold may have changed
    setResult(riskEngine.compute(blinkData, behaviorData));
  }, [blinkData, behaviorData]);

  const recordAccepted = useCallback(() => {
    riskEngine.recordAccepted();
    setResult(riskEngine.compute(blinkData, behaviorData));
  }, [blinkData, behaviorData]);

  return useMemo(
    () => ({ ...result, recordIgnored, recordAccepted }),
    [result, recordIgnored, recordAccepted]
  );
}

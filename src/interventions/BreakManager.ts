/**
 * BreakManager — intervention orchestration and escalation engine
 *
 * Receives continuous risk updates and decides when to fire each level:
 *
 *   Level 1 — NudgeIndicator   when risk = 'medium'
 *   Level 2 — Popup alert      after 3 consecutive minutes at 'medium'
 *   Level 3 — BreakOverlay     when risk = 'high' OR blinkGap > 20s
 *   20-20-20 — Forced break    every 20 minutes regardless of risk
 *
 * Deep work mode (read from AsyncStorage 'blinkwell_deepwork') silences
 * Level 1 and 2 for 25 minutes from activation.
 *
 * All intervention outcomes are persisted to 'blinkwell_interventions'.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RiskLevel } from '../engine/RiskEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InterventionLevel = 1 | 2 | 3 | '20-20-20';
export type InterventionOutcome = 'completed' | 'dismissed' | 'ignored' | 'auto_dismissed';

export interface InterventionLog {
  id: string;
  timestamp: number;
  level: InterventionLevel;
  outcome: InterventionOutcome;
  durationMs: number;
  riskLevelAtTime: RiskLevel | null;
}

export interface InterventionRequest {
  level: InterventionLevel;
  triggeredAt: number;
}

export type InterventionListener = (request: InterventionRequest) => void;

// ─── Storage keys ─────────────────────────────────────────────────────────────

const INTERVENTIONS_KEY = 'blinkwell_interventions';
const DEEP_WORK_KEY     = 'blinkwell_deepwork';

const DEEP_WORK_DURATION_MS    = 25 * 60 * 1000;
const TWENTY_TWENTY_INTERVAL_MS = 20 * 60 * 1000;
const MEDIUM_ESCALATION_MS      =  3 * 60 * 1000; // L1→L2 escalation

// Minimum gap between re-showing each level
const COOLDOWNS: Record<InterventionLevel, number> = {
  1:        90_000,  // 90 sec
  2:       300_000,  //  5 min
  3:       300_000,  //  5 min
  '20-20-20': TWENTY_TWENTY_INTERVAL_MS,
};

interface DeepWorkState {
  active: boolean;
  activatedAt: number;
}

// ─── BreakManager class ───────────────────────────────────────────────────────

export class BreakManager {
  // Escalation tracking
  private mediumRiskSince: number | null = null;
  private lastShownAt: Partial<Record<InterventionLevel, number>> = {};
  private sessionStart: number = Date.now();
  private lastTwentyTwentyAt: number = 0;

  // Active intervention tracking (for log duration)
  private activeIntervention: { level: InterventionLevel; shownAt: number } | null = null;
  private currentRiskLevel: RiskLevel | null = null;

  // Listeners
  private listeners: InterventionListener[] = [];

  // Periodic 20-20-20 ticker
  private tickerInterval: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    this.sessionStart = Date.now();
    // Check 20-20-20 every minute
    this.tickerInterval = setInterval(() => {
      this.checkTwentyTwenty();
    }, 60_000);
  }

  stop() {
    if (this.tickerInterval) clearInterval(this.tickerInterval);
  }

  // ── Primary update entry point ────────────────────────────────────────────

  /**
   * Call this every time the RiskEngine produces a new result.
   * BreakManager decides whether to trigger an intervention.
   */
  async update(riskLevel: RiskLevel, blinkGapSeconds: number): Promise<void> {
    this.currentRiskLevel = riskLevel;
    const now = Date.now();

    const deepWork = await this.isDeepWorkActive();

    // ── Level 3: high risk or blink gap > 20s ───────────────────────────
    if (riskLevel === 'high' || blinkGapSeconds > 20) {
      if (this.canFire(3, now)) {
        this.fire(3, now);
        return;
      }
    }

    // ── Level 1 & 2: medium risk (suppressed in deep work) ──────────────
    if (riskLevel === 'medium' && !deepWork) {
      // Track how long risk has been medium
      if (this.mediumRiskSince === null) {
        this.mediumRiskSince = now;
      }

      const mediumDuration = now - this.mediumRiskSince;

      // L2: 3+ consecutive minutes at medium
      if (mediumDuration >= MEDIUM_ESCALATION_MS && this.canFire(2, now)) {
        this.fire(2, now);
        return;
      }

      // L1: first nudge
      if (this.canFire(1, now)) {
        this.fire(1, now);
      }
    } else if (riskLevel !== 'medium') {
      // Risk dropped — reset medium timer
      this.mediumRiskSince = null;
    }
  }

  // ── 20-20-20 ─────────────────────────────────────────────────────────────

  private checkTwentyTwenty() {
    const now = Date.now();
    const sinceSession = now - this.sessionStart;
    const sinceLast = now - (this.lastTwentyTwentyAt || this.sessionStart);

    if (sinceSession >= TWENTY_TWENTY_INTERVAL_MS && sinceLast >= TWENTY_TWENTY_INTERVAL_MS) {
      if (this.canFire('20-20-20', now)) {
        this.fire('20-20-20', now);
      }
    }
  }

  /** Manually trigger a 20-20-20 break (e.g. user pressed the button). */
  triggerTwentyTwenty() {
    const now = Date.now();
    this.fire('20-20-20', now);
    this.lastTwentyTwentyAt = now;
  }

  // ── Outcome recording ─────────────────────────────────────────────────────

  async recordOutcome(
    level: InterventionLevel,
    outcome: InterventionOutcome
  ): Promise<void> {
    const shownAt = this.activeIntervention?.shownAt ?? Date.now();
    const durationMs = Date.now() - shownAt;
    this.activeIntervention = null;

    if (outcome === 'completed' || outcome === 'dismissed') {
      // Reset medium timer on accepted break
      if (outcome === 'completed') this.mediumRiskSince = null;
    }

    await this.appendLog({
      id: `${Date.now()}_${level}`,
      timestamp: Date.now(),
      level,
      outcome,
      durationMs,
      riskLevelAtTime: this.currentRiskLevel,
    });
  }

  // ── Deep work mode ────────────────────────────────────────────────────────

  async activateDeepWork(): Promise<void> {
    const state: DeepWorkState = { active: true, activatedAt: Date.now() };
    await AsyncStorage.setItem(DEEP_WORK_KEY, JSON.stringify(state));
    // Silence any pending L1/L2 by advancing their cooldown
    const now = Date.now();
    this.lastShownAt[1] = now;
    this.lastShownAt[2] = now;
  }

  async deactivateDeepWork(): Promise<void> {
    await AsyncStorage.setItem(
      DEEP_WORK_KEY,
      JSON.stringify({ active: false, activatedAt: 0 })
    );
  }

  async isDeepWorkActive(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(DEEP_WORK_KEY);
      if (!raw) return false;
      const state: DeepWorkState = JSON.parse(raw);
      if (!state.active) return false;
      return Date.now() - state.activatedAt < DEEP_WORK_DURATION_MS;
    } catch {
      return false;
    }
  }

  // ── Log access ────────────────────────────────────────────────────────────

  async getLogs(limit = 50): Promise<InterventionLog[]> {
    try {
      const raw = await AsyncStorage.getItem(INTERVENTIONS_KEY);
      const all: InterventionLog[] = raw ? JSON.parse(raw) : [];
      return all.slice(0, limit);
    } catch {
      return [];
    }
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────

  subscribe(listener: InterventionListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private canFire(level: InterventionLevel, now: number): boolean {
    const last = this.lastShownAt[level] ?? 0;
    return now - last >= COOLDOWNS[level];
  }

  private fire(level: InterventionLevel, now: number): void {
    this.lastShownAt[level] = now;
    if (level === '20-20-20') this.lastTwentyTwentyAt = now;

    this.activeIntervention = { level, shownAt: now };

    const request: InterventionRequest = { level, triggeredAt: now };
    this.listeners.forEach((l) => l(request));
  }

  private async appendLog(log: InterventionLog): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(INTERVENTIONS_KEY);
      const existing: InterventionLog[] = raw ? JSON.parse(raw) : [];
      existing.unshift(log);
      // Keep last 500 entries (~2 weeks of data)
      await AsyncStorage.setItem(
        INTERVENTIONS_KEY,
        JSON.stringify(existing.slice(0, 500))
      );
    } catch {}
  }
}

// Singleton
export const breakManager = new BreakManager();

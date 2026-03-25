import { RiskLevel } from './SessionService';

export type InterventionLevel = 0 | 1 | 2 | 3;

export interface InterventionState {
  level: InterventionLevel;
  message: string;
  show: boolean;
}

class InterventionEngine {
  private lastInterventionTime: number = 0;
  private ignoredCount: number = 0;
  private acceptedCount: number = 0;

  // Minimum gap between same-level interventions (ms)
  private cooldowns: Record<InterventionLevel, number> = {
    0: 0,
    1: 60_000,   // 1 min between level-1 nudges
    2: 120_000,  // 2 min between level-2 nudges
    3: 180_000,  // 3 min between level-3 nudges
  };

  evaluate(riskLevel: RiskLevel, timeSinceBreakMs: number): InterventionState {
    const now = Date.now();
    const sinceLastMs = now - this.lastInterventionTime;

    // Adaptive: if user ignores many, increase strength; if complies, reduce
    const strengthBoost = Math.min(1, Math.floor(this.ignoredCount / 3));
    const strengthReduce = this.acceptedCount > 3 ? 1 : 0;

    let targetLevel: InterventionLevel = 0;

    if (riskLevel === 'CRITICAL') {
      targetLevel = Math.max(1, (3 + strengthBoost - strengthReduce) as InterventionLevel) as InterventionLevel;
    } else if (riskLevel === 'HIGH') {
      targetLevel = Math.max(1, (2 + strengthBoost - strengthReduce) as InterventionLevel) as InterventionLevel;
    } else if (riskLevel === 'MEDIUM') {
      targetLevel = Math.max(1, (1 + strengthBoost - strengthReduce) as InterventionLevel) as InterventionLevel;
    } else {
      return { level: 0, message: '', show: false };
    }

    targetLevel = Math.min(3, Math.max(1, targetLevel)) as InterventionLevel;

    // Respect cooldown
    if (sinceLastMs < this.cooldowns[targetLevel]) {
      return { level: 0, message: '', show: false };
    }

    this.lastInterventionTime = now;

    const messages: Record<InterventionLevel, string> = {
      0: '',
      1: 'Remember to blink 👁️',
      2: 'Blink gently and slowly — your eyes need it.',
      3: 'Time for a 20-second eye break. Look away from the screen.',
    };

    return {
      level: targetLevel,
      message: messages[targetLevel],
      show: true,
    };
  }

  recordAccepted() {
    this.acceptedCount++;
  }

  recordIgnored() {
    this.ignoredCount++;
  }

  getStats() {
    return {
      accepted: this.acceptedCount,
      ignored: this.ignoredCount,
    };
  }

  reset() {
    this.lastInterventionTime = 0;
    this.ignoredCount = 0;
    this.acceptedCount = 0;
  }
}

export const interventionEngine = new InterventionEngine();

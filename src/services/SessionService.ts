import { AppState, AppStateStatus } from 'react-native';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SessionStats {
  sessionStartTime: number;
  sessionDurationMs: number;
  lastBreakTime: number;
  timeSinceBreakMs: number;
  estimatedBlinkRate: number;
  riskLevel: RiskLevel;
  isActive: boolean;
}

class SessionService {
  private sessionStart: number = 0;
  private lastBreak: number = 0;
  private isRunning: boolean = false;
  private listeners: ((stats: SessionStats) => void)[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.sessionStart = Date.now();
    this.lastBreak = Date.now();

    this.tickInterval = setInterval(() => this.tick(), 10000); // every 10s

    this.appStateSubscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'background' || state === 'inactive') {
          this.recordBreak();
        } else if (state === 'active') {
          this.sessionStart = Date.now();
        }
      }
    );
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.appStateSubscription) this.appStateSubscription.remove();
    this.isRunning = false;
  }

  recordBreak() {
    this.lastBreak = Date.now();
    this.notifyListeners();
  }

  subscribe(listener: (stats: SessionStats) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getStats(): SessionStats {
    const now = Date.now();
    const sessionDurationMs = now - this.sessionStart;
    const timeSinceBreakMs = now - this.lastBreak;
    const timeSinceBreakMin = timeSinceBreakMs / 60000;

    // Estimate blink rate based on continuous screen time (scientific model)
    let estimatedBlinkRate: number;
    let riskLevel: RiskLevel;

    if (timeSinceBreakMin < 5) {
      estimatedBlinkRate = 14;
      riskLevel = 'LOW';
    } else if (timeSinceBreakMin < 12) {
      estimatedBlinkRate = 9;
      riskLevel = 'MEDIUM';
    } else if (timeSinceBreakMin < 20) {
      estimatedBlinkRate = 6;
      riskLevel = 'HIGH';
    } else {
      estimatedBlinkRate = 4;
      riskLevel = 'CRITICAL';
    }

    return {
      sessionStartTime: this.sessionStart,
      sessionDurationMs,
      lastBreakTime: this.lastBreak,
      timeSinceBreakMs,
      estimatedBlinkRate,
      riskLevel,
      isActive: this.isRunning,
    };
  }

  private tick() {
    this.notifyListeners();
  }

  private notifyListeners() {
    const stats = this.getStats();
    this.listeners.forEach((l) => l(stats));
  }
}

export const sessionService = new SessionService();

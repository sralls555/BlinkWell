import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// If user is away for less than this, we treat it as a brief interruption (not a break)
const BREAK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'blinkwell_session';

interface PersistedSession {
  sessionStart: number;
  lastBreak: number;
}

class SessionService {
  private sessionStart: number = Date.now();
  private lastBreak: number = Date.now();
  private backgroundAt: number = 0;
  private isRunning: boolean = false;
  private listeners: ((stats: SessionStats) => void)[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Restore persisted session if within threshold
    await this.restoreSession();

    this.tickInterval = setInterval(() => this.tick(), 10000);

    this.appStateSubscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'background' || state === 'inactive') {
          this.backgroundAt = Date.now();
          this.persistSession();
        } else if (state === 'active') {
          if (this.backgroundAt > 0) {
            const awayMs = Date.now() - this.backgroundAt;

            if (awayMs >= BREAK_THRESHOLD_MS) {
              // User was genuinely away — count as a break
              this.lastBreak = Date.now();
              this.sessionStart = Date.now();
            }
            // If away < 5 min: just continue, timer keeps running
            this.backgroundAt = 0;
            this.persistSession();
            this.notifyListeners();
          }
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
    this.persistSession();
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

  private async restoreSession() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved: PersistedSession = JSON.parse(raw);
      const now = Date.now();
      const awayMs = now - saved.lastBreak;

      if (awayMs < BREAK_THRESHOLD_MS) {
        // Resume from where we left off
        this.sessionStart = saved.sessionStart;
        this.lastBreak = saved.lastBreak;
      } else {
        // Been away long enough — fresh start
        this.sessionStart = now;
        this.lastBreak = now;
      }
    } catch {
      // Fresh start on error
    }
  }

  private async persistSession() {
    try {
      const data: PersistedSession = {
        sessionStart: this.sessionStart,
        lastBreak: this.lastBreak,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  private tick() {
    this.persistSession();
    this.notifyListeners();
  }

  private notifyListeners() {
    const stats = this.getStats();
    this.listeners.forEach((l) => l(stats));
  }
}

export const sessionService = new SessionService();

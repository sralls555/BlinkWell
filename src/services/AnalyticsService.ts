import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SessionRecord {
  date: string; // YYYY-MM-DD
  avgBlinkRate: number;
  longestNoBlinkStreak: number; // minutes
  strainScore: number; // 0–100
  breaksTaken: number;
  interventionsAccepted: number;
  interventionsIgnored: number;
  totalScreenTimeMin: number;
}

export interface DailyStats {
  records: SessionRecord[];
  streak: number; // days with healthy blink behavior
  totalSessions: number;
}

const STORAGE_KEY = 'blinkwell_analytics';

class AnalyticsService {
  private records: SessionRecord[] = [];

  async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.records = JSON.parse(raw);
    } catch {
      this.records = [];
    }
  }

  async saveSession(record: Omit<SessionRecord, 'date'>) {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.records.findIndex((r) => r.date === today);

    const entry: SessionRecord = { date: today, ...record };

    if (existing >= 0) {
      // Merge with existing day record
      const prev = this.records[existing];
      this.records[existing] = {
        ...entry,
        avgBlinkRate: Math.round((prev.avgBlinkRate + record.avgBlinkRate) / 2),
        longestNoBlinkStreak: Math.max(prev.longestNoBlinkStreak, record.longestNoBlinkStreak),
        strainScore: Math.round((prev.strainScore + record.strainScore) / 2),
        breaksTaken: prev.breaksTaken + record.breaksTaken,
        interventionsAccepted: prev.interventionsAccepted + record.interventionsAccepted,
        interventionsIgnored: prev.interventionsIgnored + record.interventionsIgnored,
        totalScreenTimeMin: prev.totalScreenTimeMin + record.totalScreenTimeMin,
      };
    } else {
      this.records.unshift(entry);
      if (this.records.length > 30) this.records = this.records.slice(0, 30);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
  }

  getRecentRecords(days: number = 7): SessionRecord[] {
    return this.records.slice(0, days);
  }

  getTodayRecord(): SessionRecord | null {
    const today = new Date().toISOString().split('T')[0];
    return this.records.find((r) => r.date === today) ?? null;
  }

  getStreak(): number {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < this.records.length; i++) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      const rec = this.records.find((r) => r.date === expectedStr);
      if (rec && rec.avgBlinkRate >= 10) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  computeStrainScore(avgBlinkRate: number, longestStreakMin: number, screenTimeMin: number): number {
    // Higher blink rate = lower strain
    const blinkPenalty = Math.max(0, (15 - avgBlinkRate) * 3);
    const streakPenalty = Math.min(40, longestStreakMin * 2);
    const timePenalty = Math.min(20, screenTimeMin * 0.2);
    return Math.min(100, Math.round(blinkPenalty + streakPenalty + timePenalty));
  }
}

export const analyticsService = new AnalyticsService();

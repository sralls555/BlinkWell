/**
 * BehaviorSensor — behavior-based eye strain sensing module
 *
 * Tracks screen session duration, app category, touch velocity and
 * time-of-day to produce a continuous risk score without any camera access.
 *
 * Android: runs a foreground service so the timer survives app-switching.
 * iOS:     uses expo-background-fetch for periodic state persistence.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AppState,
  AppStateStatus,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

// ─── Constants ───────────────────────────────────────────────────────────────

export const SESSIONS_STORAGE_KEY = 'blinkwell_sessions';

/** How long the screen must be off before we treat it as a real break. */
const INACTIVE_BREAK_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

const BG_FETCH_TASK = 'BLINKWELL_BG_FETCH';
const FOREGROUND_TASK = 'blinkwell_fg_task';
const FOREGROUND_SERVICE_ID = 1001;

// ─── Types ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';
export type AppCategory =
  | 'social_media'
  | 'video'
  | 'reading'
  | 'audio'
  | 'other';

export interface SessionRisk {
  sessionMinutes: number;
  riskMultiplier: number;
  riskLevel: RiskLevel;
  appCategory: AppCategory;
  touchVelocity: number; // avg touches/sec in last 30s
  isNightTime: boolean;
}

export interface SessionSnapshot {
  timestamp: number;
  sessionMinutes: number;
  riskLevel: RiskLevel;
  riskMultiplier: number;
  appCategory: AppCategory;
}

// ─── App-category → risk multiplier map ─────────────────────────────────────
//
// Package name prefixes (Android) → category.
// On iOS package names aren't available; callers pass a category hint via
// setAppCategory() from their navigation/screen logic instead.

const PACKAGE_CATEGORY_MAP: Record<string, AppCategory> = {
  // Social media
  'com.facebook': 'social_media',
  'com.instagram': 'social_media',
  'com.twitter': 'social_media',
  'com.zhiliaoapp.musically': 'social_media', // TikTok
  'com.snapchat': 'social_media',
  'com.linkedin': 'social_media',
  'com.reddit': 'social_media',
  'com.whatsapp': 'social_media',
  'org.telegram': 'social_media',
  // Video
  'com.google.android.youtube': 'video',
  'com.netflix': 'video',
  'com.amazon.avod': 'video',
  'com.disney': 'video',
  'com.hotstar': 'video',
  'tv.twitch': 'video',
  // Reading
  'com.google.android.apps.docs': 'reading',
  'com.adobe.reader': 'reading',
  'com.kindle': 'reading',
  'com.medium': 'reading',
  'com.google.android.apps.magazines': 'reading',
  // Audio
  'com.spotify': 'audio',
  'com.apple.music': 'audio',
  'com.google.android.music': 'audio',
  'com.soundcloud': 'audio',
  'com.podcast': 'audio',
};

const CATEGORY_MULTIPLIERS: Record<AppCategory, number> = {
  social_media: 1.5,
  video: 1.2,
  reading: 1.0,
  audio: 0.2,
  other: 1.0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveCategory(packageName: string): AppCategory {
  for (const prefix of Object.keys(PACKAGE_CATEGORY_MAP)) {
    if (packageName.startsWith(prefix)) return PACKAGE_CATEGORY_MAP[prefix];
  }
  return 'other';
}

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 2; // 21:00 – 02:00
}

function computeRiskLevel(effectiveMinutes: number): RiskLevel {
  if (effectiveMinutes < 10) return 'low';
  if (effectiveMinutes < 20) return 'medium';
  return 'high';
}

// ─── iOS background fetch task ───────────────────────────────────────────────

TaskManager.defineTask(BG_FETCH_TASK, async () => {
  try {
    await behaviorSensor.persistSnapshot();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Android foreground service task (registered at module load time) ────────
// add_task is called after start(); registration is deferred to startForegroundService()

// ─── Core sensor class ────────────────────────────────────────────────────────

class BehaviorSensor {
  // Session timing
  private sessionStart: number = Date.now();
  private lastActiveTime: number = Date.now();
  private backgroundAt: number = 0;

  // Context
  private currentCategory: AppCategory = 'other';
  private currentPackage: string = '';

  // Touch velocity tracking (rolling 30-second window)
  private touchEvents: number[] = []; // timestamps of touch events
  private readonly TOUCH_WINDOW_MS = 30_000;

  // Listeners
  private stateListeners: ((risk: SessionRisk) => void)[] = [];
  private appStateSubscription: { remove: () => void } | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async start() {
    await this.restoreSession();
    this.setupAppStateListener();
    this.startTicker();

    if (Platform.OS === 'android') {
      await this.startForegroundService();
    } else {
      await this.registerBackgroundFetch();
    }
  }

  async stop() {
    this.appStateSubscription?.remove();
    if (this.tickInterval) clearInterval(this.tickInterval);
    await this.persistSnapshot();

    if (Platform.OS === 'android') {
      try { ReactNativeForegroundService.stop(); } catch {}
    } else {
      try { await BackgroundFetch.unregisterTaskAsync(BG_FETCH_TASK); } catch {}
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  getSessionRisk(): SessionRisk {
    const sessionMinutes = (Date.now() - this.sessionStart) / 60_000;
    const categoryMultiplier = CATEGORY_MULTIPLIERS[this.currentCategory];
    const nightMultiplier = isNightHour() ? 1.3 : 1.0;
    const velocityMultiplier = this.getVelocityMultiplier();
    const riskMultiplier = categoryMultiplier * nightMultiplier * velocityMultiplier;
    const effectiveMinutes = sessionMinutes * riskMultiplier;
    const riskLevel = computeRiskLevel(effectiveMinutes);

    return {
      sessionMinutes: Math.round(sessionMinutes * 10) / 10,
      riskMultiplier: Math.round(riskMultiplier * 100) / 100,
      riskLevel,
      appCategory: this.currentCategory,
      touchVelocity: this.getTouchVelocity(),
      isNightTime: isNightHour(),
    };
  }

  /**
   * Call this from navigation / screen-change events to set which category
   * the user is currently in (works on both iOS and Android).
   */
  setAppCategory(category: AppCategory) {
    this.currentCategory = category;
  }

  /**
   * Call with Android package name to auto-resolve category.
   * e.g. setPackageName('com.instagram.android')
   */
  setPackageName(packageName: string) {
    this.currentPackage = packageName;
    this.currentCategory = resolveCategory(packageName);
  }

  /**
   * Record a touch event from the global touch interceptor.
   * Call this from the onStartShouldSetResponderCapture handler in App.tsx.
   */
  recordTouch(_event: GestureResponderEvent) {
    const now = Date.now();
    this.touchEvents.push(now);
    this.pruneOldTouches(now);
  }

  recordScroll() {
    this.recordTouch({ nativeEvent: {} } as GestureResponderEvent);
  }

  resetSession() {
    this.sessionStart = Date.now();
    this.lastActiveTime = Date.now();
    this.touchEvents = [];
    this.notify();
  }

  subscribe(listener: (risk: SessionRisk) => void) {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  async persistSnapshot() {
    try {
      const risk = this.getSessionRisk();
      const snapshot: SessionSnapshot = {
        timestamp: Date.now(),
        sessionMinutes: risk.sessionMinutes,
        riskLevel: risk.riskLevel,
        riskMultiplier: risk.riskMultiplier,
        appCategory: risk.appCategory,
      };

      const raw = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      const existing: SessionSnapshot[] = raw ? JSON.parse(raw) : [];
      existing.unshift(snapshot);

      // Keep last 200 snapshots (~3-4 days at 10-min intervals)
      const trimmed = existing.slice(0, 200);
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  async getStoredSnapshots(): Promise<SessionSnapshot[]> {
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'background' || state === 'inactive') {
          this.backgroundAt = Date.now();
          this.persistSnapshot();
        } else if (state === 'active') {
          if (this.backgroundAt > 0) {
            const awayMs = Date.now() - this.backgroundAt;
            if (awayMs >= INACTIVE_BREAK_THRESHOLD_MS) {
              // Genuine break — reset session clock
              this.sessionStart = Date.now();
              this.touchEvents = [];
            }
            // < 3 min away: timer continues uninterrupted
            this.backgroundAt = 0;
          }
          this.lastActiveTime = Date.now();
          this.notify();
        }
      }
    );
  }

  private startTicker() {
    // Notify listeners every 15 seconds; persist every 5 minutes
    let tickCount = 0;
    this.tickInterval = setInterval(() => {
      this.pruneOldTouches(Date.now());
      this.notify();
      tickCount++;
      if (tickCount % 20 === 0) this.persistSnapshot(); // every ~5 min
    }, 15_000);
  }

  private async startForegroundService() {
    try {
      // Step 1: register the service config + internal task runner
      ReactNativeForegroundService.register({
        config: {
          alert: false,
          onServiceErrorCallBack: () =>
            console.warn('[BehaviorSensor] Foreground service error'),
        },
      });

      // Step 2: start the persistent notification
      await ReactNativeForegroundService.start({
        id: FOREGROUND_SERVICE_ID,
        title: 'BlinkWell',
        message: 'Monitoring eye health in the background',
        icon: 'ic_notification',
        importance: 'low',
      });

      // Step 3: add our snapshot task to run every 5 minutes
      ReactNativeForegroundService.add_task(
        () => behaviorSensor.persistSnapshot(),
        {
          delay: 5 * 60 * 1000,
          onLoop: true,
          taskId: FOREGROUND_TASK,
          onSuccess: () => {},
          onError: (e: unknown) =>
            console.warn('[BehaviorSensor] FG task error:', e),
        }
      );
    } catch (e) {
      // Graceful fallback if native module not available (e.g. Expo Go)
      console.warn('[BehaviorSensor] Foreground service unavailable:', e);
    }
  }

  private async registerBackgroundFetch() {
    try {
      await BackgroundFetch.registerTaskAsync(BG_FETCH_TASK, {
        minimumInterval: 15 * 60, // iOS minimum: 15 min
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (e) {
      console.warn('[BehaviorSensor] Background fetch unavailable:', e);
    }
  }

  private async restoreSession() {
    try {
      const snapshots = await this.getStoredSnapshots();
      if (!snapshots.length) return;

      const last = snapshots[0];
      const awayMs = Date.now() - last.timestamp;

      if (awayMs < INACTIVE_BREAK_THRESHOLD_MS) {
        // Resume accumulated session time
        this.sessionStart = Date.now() - last.sessionMinutes * 60_000;
        this.currentCategory = last.appCategory;
      }
      // else: fresh session
    } catch {}
  }

  private getTouchVelocity(): number {
    const now = Date.now();
    const recent = this.touchEvents.filter(
      (t) => now - t <= this.TOUCH_WINDOW_MS
    );
    return Math.round((recent.length / (this.TOUCH_WINDOW_MS / 1000)) * 10) / 10;
  }

  /**
   * High touch velocity → user is actively scrolling → higher strain.
   * Low velocity → passive reading or video.
   */
  private getVelocityMultiplier(): number {
    const vel = this.getTouchVelocity();
    if (vel > 3) return 1.2;   // rapid scrolling
    if (vel > 1) return 1.1;   // moderate activity
    return 1.0;                  // passive / idle
  }

  private pruneOldTouches(now: number) {
    this.touchEvents = this.touchEvents.filter(
      (t) => now - t <= this.TOUCH_WINDOW_MS
    );
  }

  private notify() {
    const risk = this.getSessionRisk();
    this.stateListeners.forEach((l) => l(risk));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const behaviorSensor = new BehaviorSensor();

// ─── React hook ───────────────────────────────────────────────────────────────

export function useBehaviorSensor() {
  const [risk, setRisk] = useState<SessionRisk>(behaviorSensor.getSessionRisk());
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      behaviorSensor.start();
    }

    const unsub = behaviorSensor.subscribe(setRisk);
    return unsub;
  }, []);

  const setAppCategory = useCallback((category: AppCategory) => {
    behaviorSensor.setAppCategory(category);
  }, []);

  const setPackageName = useCallback((pkg: string) => {
    behaviorSensor.setPackageName(pkg);
  }, []);

  const recordTouch = useCallback((e: GestureResponderEvent) => {
    behaviorSensor.recordTouch(e);
  }, []);

  const recordScroll = useCallback(() => {
    behaviorSensor.recordScroll();
  }, []);

  const resetSession = useCallback(() => {
    behaviorSensor.resetSession();
  }, []);

  return {
    risk,
    setAppCategory,
    setPackageName,
    recordTouch,
    recordScroll,
    resetSession,
  };
}

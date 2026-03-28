/**
 * BlinkDetector — camera-based blink detection via Eye Aspect Ratio (EAR)
 *
 * EAR = (|p2−p6| + |p3−p5|) / (2 · |p1−p4|)
 *
 * where p1–p6 are the 6 eye contour landmarks (dlib convention):
 *   p1 = left corner,  p4 = right corner
 *   p2 = upper-left,   p3 = upper-right
 *   p6 = lower-left,   p5 = lower-right
 *
 * Points are extracted geometrically from ML Kit's variable-length eye
 * contour arrays so the calculation is stable across devices.
 *
 * Blink state machine:
 *   OPEN ──(EAR < closeThreshold)──► CLOSING
 *   CLOSING ──(EAR < closeThreshold, sustained)──► CLOSED
 *   CLOSED  ──(EAR > openThreshold)──► OPEN  → blink counted
 */

import type { Face, Contours } from 'react-native-vision-camera-face-detector';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlinkStats {
  blinksPerMinute: number;
  lastBlinkTimestamp: number;
  avgEAR: number;
  blinkGapSeconds: number;
  isCalibrated: boolean;
  totalBlinks: number;
}

type BlinkState = 'OPEN' | 'CLOSING' | 'CLOSED' | 'OPENING';

interface Point2D {
  x: number;
  y: number;
}

// ─── EAR geometry helpers ─────────────────────────────────────────────────────

function dist(a: Point2D, b: Point2D): number {
  'worklet';
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Extract the 6 canonical EAR landmarks from ML Kit's variable-length
 * eye contour array using pure geometry.
 *
 * Strategy:
 *  1. p1 = leftmost point  (min x)
 *  2. p4 = rightmost point (max x)
 *  3. Split remaining points into upper half (y ≤ center.y) and lower half
 *  4. p2 = upper half at ~1/3 horizontal span
 *  5. p3 = upper half at ~2/3 horizontal span
 *  6. p5 = lower half at ~2/3 horizontal span
 *  7. p6 = lower half at ~1/3 horizontal span
 */
function extractEyeLandmarks(
  contour: Point2D[]
): [Point2D, Point2D, Point2D, Point2D, Point2D, Point2D] | null {
  'worklet';
  if (!contour || contour.length < 4) return null;

  // Find extreme points
  let p1 = contour[0]; // leftmost
  let p4 = contour[0]; // rightmost
  let sumX = 0, sumY = 0;

  for (const pt of contour) {
    if (pt.x < p1.x) p1 = pt;
    if (pt.x > p4.x) p4 = pt;
    sumX += pt.x;
    sumY += pt.y;
  }

  const centerY = sumY / contour.length;
  const xSpan = p4.x - p1.x;
  if (xSpan < 1) return null;

  // Split into upper and lower halves, sort by x
  const upper = contour.filter((pt) => pt.y <= centerY).sort((a, b) => a.x - b.x);
  const lower = contour.filter((pt) => pt.y > centerY).sort((a, b) => a.x - b.x);

  if (upper.length < 2 || lower.length < 2) return null;

  // Pick at ~1/3 and ~2/3 of the sorted arrays
  const p2 = upper[Math.floor(upper.length / 3)];
  const p3 = upper[Math.floor((upper.length * 2) / 3)];
  const p5 = lower[Math.floor((lower.length * 2) / 3)];
  const p6 = lower[Math.floor(lower.length / 3)];

  return [p1, p2, p3, p4, p5, p6];
}

/**
 * Calculate EAR from 6 landmarks.
 *  EAR = (|p2−p6| + |p3−p5|) / (2 · |p1−p4|)
 */
function calcEAR(
  p1: Point2D, p2: Point2D, p3: Point2D,
  p4: Point2D, p5: Point2D, p6: Point2D
): number {
  'worklet';
  const num = dist(p2, p6) + dist(p3, p5);
  const den = 2 * dist(p1, p4);
  if (den < 0.001) return 0;
  return num / den;
}

/**
 * Compute average EAR across both eyes from a detected Face.
 * Returns null if landmarks are unavailable.
 */
export function computeFaceEAR(face: Face): number | null {
  'worklet';
  const contours = face.contours as Contours | undefined;
  if (!contours?.LEFT_EYE || !contours?.RIGHT_EYE) return null;

  const leftLm = extractEyeLandmarks(contours.LEFT_EYE as Point2D[]);
  const rightLm = extractEyeLandmarks(contours.RIGHT_EYE as Point2D[]);

  if (!leftLm || !rightLm) return null;

  const leftEAR = calcEAR(...leftLm);
  const rightEAR = calcEAR(...rightLm);

  return (leftEAR + rightEAR) / 2;
}

// ─── BlinkDetector class ──────────────────────────────────────────────────────

const CALIBRATION_DURATION_MS = 10_000;
const ROLLING_WINDOW_MS = 60_000;

// Default thresholds (overridden after calibration)
const DEFAULT_CLOSE_THRESHOLD = 0.21;
const DEFAULT_OPEN_THRESHOLD = 0.24;

export class BlinkDetector {
  // Thresholds — updated post-calibration
  closeThreshold = DEFAULT_CLOSE_THRESHOLD;
  openThreshold = DEFAULT_OPEN_THRESHOLD;

  // Blink state machine
  private state: BlinkState = 'OPEN';

  // Rolling 60-second blink timestamp window
  private blinkTimestamps: number[] = [];

  // EAR rolling average
  private earSamples: number[] = [];
  private readonly MAX_EAR_SAMPLES = 30;

  // Calibration
  private calibrationStart: number = 0;
  private calibrationEARSamples: number[] = [];
  private _isCalibrated = false;

  // Stats
  private lastBlinkTs = 0;
  private totalBlinks = 0;

  // Listeners
  private listeners: ((stats: BlinkStats) => void)[] = [];

  // ── Public API ─────────────────────────────────────────────────────────────

  startCalibration() {
    this.calibrationStart = Date.now();
    this.calibrationEARSamples = [];
    this._isCalibrated = false;
  }

  get isCalibrated() {
    return this._isCalibrated;
  }

  /**
   * Feed a new EAR value from the frame processor.
   * This runs on the JS thread (called via runOnJS from the worklet).
   */
  processEAR(ear: number) {
    const now = Date.now();

    // ── Calibration phase ──────────────────────────────────────────────────
    if (!this._isCalibrated) {
      const elapsed = now - this.calibrationStart;

      // Only collect EAR samples when eye appears open (ear > 0.15 filters out blinks)
      if (ear > 0.15) {
        this.calibrationEARSamples.push(ear);
      }

      if (elapsed >= CALIBRATION_DURATION_MS) {
        this.finalizeCalibration();
      }
      return; // Don't count blinks during calibration
    }

    // ── Blink state machine ────────────────────────────────────────────────
    this.updateEARAverage(ear);
    this.updateBlinkState(ear, now);
    this.pruneBlinkWindow(now);
    this.notifyListeners();
  }

  getStats(): BlinkStats {
    const now = Date.now();
    this.pruneBlinkWindow(now);

    return {
      blinksPerMinute: this.blinkTimestamps.length, // count in last 60s
      lastBlinkTimestamp: this.lastBlinkTs,
      avgEAR: this.getAvgEAR(),
      blinkGapSeconds: this.lastBlinkTs > 0 ? (now - this.lastBlinkTs) / 1000 : 0,
      isCalibrated: this._isCalibrated,
      totalBlinks: this.totalBlinks,
    };
  }

  subscribe(listener: (stats: BlinkStats) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  reset() {
    this.state = 'OPEN';
    this.blinkTimestamps = [];
    this.earSamples = [];
    this.lastBlinkTs = 0;
    this.totalBlinks = 0;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private updateBlinkState(ear: number, now: number) {
    switch (this.state) {
      case 'OPEN':
        if (ear < this.closeThreshold) {
          this.state = 'CLOSING';
        }
        break;

      case 'CLOSING':
        if (ear < this.closeThreshold) {
          this.state = 'CLOSED';
        } else {
          // Transient dip — return to open
          this.state = 'OPEN';
        }
        break;

      case 'CLOSED':
        if (ear > this.openThreshold) {
          this.state = 'OPENING';
        }
        break;

      case 'OPENING':
        if (ear >= this.openThreshold) {
          // Blink complete
          this.recordBlink(now);
          this.state = 'OPEN';
        } else if (ear < this.closeThreshold) {
          // Went back down — still closed
          this.state = 'CLOSED';
        }
        break;
    }
  }

  private recordBlink(now: number) {
    this.blinkTimestamps.push(now);
    this.lastBlinkTs = now;
    this.totalBlinks++;
  }

  private pruneBlinkWindow(now: number) {
    this.blinkTimestamps = this.blinkTimestamps.filter(
      (ts) => now - ts <= ROLLING_WINDOW_MS
    );
  }

  private updateEARAverage(ear: number) {
    this.earSamples.push(ear);
    if (this.earSamples.length > this.MAX_EAR_SAMPLES) {
      this.earSamples.shift();
    }
  }

  private getAvgEAR(): number {
    if (!this.earSamples.length) return 0;
    return this.earSamples.reduce((s, v) => s + v, 0) / this.earSamples.length;
  }

  private finalizeCalibration() {
    if (this.calibrationEARSamples.length < 5) {
      // Not enough data — use defaults and try again
      this.startCalibration();
      return;
    }

    const sorted = [...this.calibrationEARSamples].sort((a, b) => a - b);
    // Use the 80th percentile as the open-eye baseline (robust to partial blinks)
    const p80 = sorted[Math.floor(sorted.length * 0.8)];

    this.closeThreshold = p80 * 0.72; // 72% of baseline = eyes nearly closed
    this.openThreshold = p80 * 0.84;  // 84% of baseline = eyes returning to open

    this._isCalibrated = true;
  }

  private notifyListeners() {
    const stats = this.getStats();
    this.listeners.forEach((l) => l(stats));
  }
}

// Singleton — shared across the app
export const blinkDetector = new BlinkDetector();

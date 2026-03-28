/**
 * useBlinkDetector — React hook for camera-based blink detection
 *
 * Sets up the front camera, registers a frame processor running at 15 FPS,
 * feeds EAR values to BlinkDetector, and returns live stats.
 *
 * Falls back silently to behavior-sensor mode if camera permission is denied
 * or if the device doesn't support frame processors.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  runAtTargetFps,
  runAsync,
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { runOnJS } from 'react-native-reanimated';

import { blinkDetector, computeFaceEAR, type BlinkStats } from './BlinkDetector';
import { behaviorSensor } from './BehaviorSensor';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DetectionMode = 'camera' | 'behavior_fallback';

export interface BlinkDetectorResult {
  /** Blinks counted in the last 60 seconds */
  blinksPerMinute: number;
  /** Seconds since the last detected blink */
  lastBlinkGapSec: number;
  /** True once the 10-second calibration phase has completed */
  isCalibrated: boolean;
  /** Which sensing mode is active */
  mode: DetectionMode;
  /** Raw average EAR (0–1); useful for debugging / calibration UI */
  avgEAR: number;
  /** Total blinks counted in this session */
  totalBlinks: number;
  /** Start / stop camera detection manually */
  startDetection: () => Promise<void>;
  stopDetection: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBlinkDetector(): BlinkDetectorResult {
  const [stats, setStats] = useState<BlinkStats>(blinkDetector.getStats());
  const [mode, setMode] = useState<DetectionMode>('behavior_fallback');
  const [isActive, setIsActive] = useState(false);

  const device = useCameraDevice('front');

  // Face detector plugin — contour mode for accurate EAR landmarks
  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    contourMode: 'all',
    classificationMode: 'none',
    landmarkMode: 'none',
    minFaceSize: 0.25,
    cameraFacing: 'front',
  });

  // ── Permission & startup ─────────────────────────────────────────────────

  const startDetection = useCallback(async () => {
    // Request camera permission
    const current = Camera.getCameraPermissionStatus();
    let granted = current === 'granted';

    if (!granted) {
      const result = await Camera.requestCameraPermission();
      granted = result === 'granted';
    }

    if (!granted) {
      // Graceful fallback — behavior sensor already running
      setMode('behavior_fallback');
      return;
    }

    if (!device) {
      setMode('behavior_fallback');
      return;
    }

    blinkDetector.startCalibration();
    setIsActive(true);
    setMode('camera');
  }, [device]);

  const stopDetection = useCallback(() => {
    setIsActive(false);
    setMode('behavior_fallback');
    blinkDetector.reset();
  }, []);

  // ── Subscribe to blink stats ─────────────────────────────────────────────

  useEffect(() => {
    const unsub = blinkDetector.subscribe(setStats);
    return unsub;
  }, []);

  // ── runOnJS bridge: called from worklet to pass EAR to JS thread ──────────

  const handleEAR = useCallback((ear: number) => {
    blinkDetector.processEAR(ear);
  }, []);

  // ── Frame processor (worklet — runs on camera thread at 15 FPS) ──────────

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      runAtTargetFps(15, () => {
        'worklet';

        // Run face detection in async context so camera doesn't drop frames
        runAsync(frame, () => {
          'worklet';

          const faces = detectFaces(frame);
          if (!faces.length) return;

          // Use the largest (closest) face only
          const face = faces.reduce((best, f) =>
            f.bounds.width > best.bounds.width ? f : best
          );

          const ear = computeFaceEAR(face);
          if (ear === null) return;

          // Bridge to JS thread — blinkDetector.processEAR must run on JS
          runOnJS(handleEAR)(ear);
        });
      });
    },
    [detectFaces, handleEAR]
  );

  // ── Derived values ───────────────────────────────────────────────────────

  const result = useMemo<BlinkDetectorResult>(
    () => ({
      blinksPerMinute: stats.blinksPerMinute,
      lastBlinkGapSec: stats.blinkGapSeconds,
      isCalibrated: stats.isCalibrated,
      mode,
      avgEAR: stats.avgEAR,
      totalBlinks: stats.totalBlinks,
      startDetection,
      stopDetection,
    }),
    [stats, mode, startDetection, stopDetection]
  );

  // Expose frame processor and camera state so the consuming component
  // can mount the <Camera> only when active
  return Object.assign(result, { frameProcessor, isActive, device });
}

// ─── Camera component props helper ───────────────────────────────────────────
//
// Usage in your component:
//
//   const detector = useBlinkDetector()
//
//   // Mount the invisible camera only when detection is active
//   {detector.isActive && detector.device && (
//     <Camera
//       style={StyleSheet.absoluteFill}        // or { width: 1, height: 1 }
//       device={detector.device}
//       isActive={detector.isActive}
//       frameProcessor={detector.frameProcessor}
//       fps={15}
//       pixelFormat="yuv"
//       outputOrientation="device"
//     />
//   )}

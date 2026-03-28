/**
 * EyeHealthProvider — root orchestrator
 *
 * Initialisation order on mount:
 *   1. BehaviorSensor.start()   — no permission, always runs
 *   2. Camera permission check  — via react-native-permissions
 *      ✓ granted  → BlinkDetector.startCalibration() + mount hidden <Camera>
 *      ✗ denied   → log 'camera_denied', stay in behavior-only mode
 *   3. 5-second update loop     → RiskEngine.compute() → BreakManager.update()
 *   4. BreakManager subscription → render NudgeIndicator / L2Modal / BreakOverlay
 *
 * All intervention state lives here so overlays sit above the navigator.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Camera } from 'react-native-vision-camera';

import { behaviorSensor }               from '../sensing/BehaviorSensor';
import { blinkDetector as detector }    from '../sensing/BlinkDetector';
import { useBlinkDetector }             from '../sensing/useBlinkDetector';
import { riskEngine }                   from '../engine/RiskEngine';
import type { RiskLevel, RiskEngineResult } from '../engine/RiskEngine';
import { breakManager }                        from '../interventions/BreakManager';
import type { InterventionRequest, InterventionOutcome } from '../interventions/BreakManager';
import BreakOverlay                     from '../interventions/BreakOverlay';
import NudgeIndicator                   from '../interventions/NudgeIndicator';

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMERA_DENIED_KEY  = 'blinkwell_camera_denied';
const UPDATE_INTERVAL_MS = 5_000;

const CAMERA_PERMISSION = Platform.select({
  android: PERMISSIONS.ANDROID.CAMERA,
  ios:     PERMISSIONS.IOS.CAMERA,
})!;

// ─── Context ──────────────────────────────────────────────────────────────────

export interface EyeHealthContextValue {
  riskLevel:       RiskLevel;
  riskScore:       number;
  blinksPerMinute: number;
  sessionMinutes:  number;
  isCameraActive:  boolean;
  deepWorkMode:    boolean;
  recommendation:  string;
  signalSource:    'camera' | 'behavior_fallback';
  setDeepWorkMode: (active: boolean) => void;
  enableCamera:    () => Promise<boolean>; // request permission and start
  disableCamera:   () => void;
}

const EyeHealthContext = createContext<EyeHealthContextValue | null>(null);

export function useEyeHealth(): EyeHealthContextValue {
  const ctx = useContext(EyeHealthContext);
  if (!ctx) throw new Error('useEyeHealth must be used inside <EyeHealthProvider>');
  return ctx;
}

// ─── L2 popup (inline — keeps BreakOverlay for L3/20-20-20 only) ─────────────

interface L2ModalProps {
  visible:   boolean;
  onAccept:  () => void;
  onDismiss: () => void;
}

function L2Modal({ visible, onAccept, onDismiss }: L2ModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    return () => { fadeAnim.setValue(0); scaleAnim.setValue(0.92); };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Animated.View style={[styles.l2Backdrop, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.l2Card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.l2Icon}>👁️</Text>
          <Text style={styles.l2Title}>Blink gently</Text>
          <Text style={styles.l2Body}>
            Your blink rate has been below normal for 3+ minutes.{'\n'}
            Slow blinking re-lubricates and relaxes your eyes.
          </Text>
          <View style={styles.l2Buttons}>
            <TouchableOpacity style={styles.l2Accept} onPress={onAccept}>
              <Text style={styles.l2AcceptText}>Got it — blinking now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.l2Dismiss} onPress={onDismiss}>
              <Text style={styles.l2DismissText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface Props { children: ReactNode }

export default function EyeHealthProvider({ children }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [isCameraActive,  setIsCameraActive]  = useState(false);
  const [deepWorkMode,    setDeepWorkModeState] = useState(false);
  const [riskResult,      setRiskResult]       = useState<RiskEngineResult>(() =>
    riskEngine.compute(null, { sessionMinutes: 0, appCategoryMultiplier: 1, timeOfDayMultiplier: 1 })
  );
  const [blinksPerMinute, setBlinksPM]        = useState(0);
  const [sessionMinutes,  setSessionMinutes]  = useState(0);

  // Intervention display state
  const [showNudge,       setShowNudge]       = useState(false);
  const [showL2,          setShowL2]          = useState(false);
  const [overlayRequest,  setOverlayRequest]  = useState<InterventionRequest | null>(null);

  // ── BlinkDetector hook (manages frame processor + Camera component) ────────

  const blinkDetectorHook = useBlinkDetector();

  // ── Init: BehaviorSensor + BreakManager ───────────────────────────────────

  useEffect(() => {
    behaviorSensor.start();
    breakManager.start();

    // Restore deep work mode from AsyncStorage
    AsyncStorage.getItem('blinkwell_deepwork').then((raw) => {
      if (!raw) return;
      try {
        const state = JSON.parse(raw);
        if (state.active && Date.now() - state.activatedAt < 25 * 60 * 1000) {
          setDeepWorkModeState(true);
        }
      } catch {}
    });

    // Check if camera was previously denied — auto-try if not
    AsyncStorage.getItem(CAMERA_DENIED_KEY).then((val) => {
      if (val !== 'true') attemptCameraStart();
    });

    return () => {
      behaviorSensor.stop();
      breakManager.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to BreakManager interventions ───────────────────────────────

  useEffect(() => {
    const unsub = breakManager.subscribe((req: InterventionRequest) => {
      if (req.level === 1) {
        setShowNudge(true);
      } else if (req.level === 2) {
        setShowL2(true);
      } else {
        // Level 3 or 20-20-20 → full BreakOverlay
        setOverlayRequest(req);
      }
    });
    return unsub;
  }, []);

  // ── 5-second risk update loop ─────────────────────────────────────────────

  useEffect(() => {
    const tick = async () => {
      const sessionRisk = behaviorSensor.getSessionRisk();
      const blinkStats  = detector.getStats();

      setSessionMinutes(sessionRisk.sessionMinutes);

      const blinkInput = isCameraActive && blinkStats.isCalibrated
        ? {
            blinksPerMinute: blinkStats.blinksPerMinute,
            blinkGapSeconds: blinkStats.blinkGapSeconds,
            isCalibrated:    true,
          }
        : null;

      setBlinksPM(blinkInput ? blinkStats.blinksPerMinute : 0);

      // BehaviorSensor riskMultiplier already combines category + night + velocity.
      // Pass it as appCategoryMultiplier with timeOfDayMultiplier=1 to avoid double-counting.
      const behaviorInput = {
        sessionMinutes:       sessionRisk.sessionMinutes,
        appCategoryMultiplier: sessionRisk.riskMultiplier,
        timeOfDayMultiplier:  1.0,
        lastActivityTimestamp: Date.now(),
      };

      const result = riskEngine.compute(blinkInput, behaviorInput);
      setRiskResult(result);

      // Feed into BreakManager
      if (result.shouldIntervene || result.riskLevel !== 'low') {
        await breakManager.update(
          result.riskLevel,
          blinkInput?.blinkGapSeconds ?? 0
        );
      }
    };

    tick(); // immediate first tick
    const interval = setInterval(tick, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isCameraActive]);

  // ── Camera permission helpers ─────────────────────────────────────────────

  const attemptCameraStart = useCallback(async () => {
    try {
      const status = await check(CAMERA_PERMISSION);
      if (status === RESULTS.GRANTED) {
        await blinkDetectorHook.startDetection();
        setIsCameraActive(true);
      }
    } catch {}
  }, [blinkDetectorHook]);

  const enableCamera = useCallback(async (): Promise<boolean> => {
    try {
      const status = await request(CAMERA_PERMISSION);
      if (status === RESULTS.GRANTED) {
        await AsyncStorage.removeItem(CAMERA_DENIED_KEY);
        await blinkDetectorHook.startDetection();
        setIsCameraActive(true);
        return true;
      } else {
        await AsyncStorage.setItem(CAMERA_DENIED_KEY, 'true');
        setIsCameraActive(false);
        return false;
      }
    } catch {
      return false;
    }
  }, [blinkDetectorHook]);

  const disableCamera = useCallback(() => {
    blinkDetectorHook.stopDetection();
    setIsCameraActive(false);
    detector.reset();
    setBlinksPM(0);
  }, [blinkDetectorHook]);

  // ── Deep work mode ────────────────────────────────────────────────────────

  const setDeepWorkMode = useCallback(async (active: boolean) => {
    setDeepWorkModeState(active);
    if (active) {
      await breakManager.activateDeepWork();
    } else {
      await breakManager.deactivateDeepWork();
    }
  }, []);

  // ── Intervention handlers ─────────────────────────────────────────────────

  const handleNudgeTap = useCallback(() => {
    setShowNudge(false);
    riskEngine.recordAccepted();
    breakManager.recordOutcome(1, 'completed');
    // Trigger an early manual 20-20-20 hint
    breakManager.triggerTwentyTwenty();
  }, []);

  const handleNudgeAutoDismiss = useCallback(() => {
    setShowNudge(false);
    riskEngine.recordIgnored();
    breakManager.recordOutcome(1, 'auto_dismissed');
  }, []);

  const handleL2Accept = useCallback(() => {
    setShowL2(false);
    riskEngine.recordAccepted();
    breakManager.recordOutcome(2, 'completed');
    behaviorSensor.resetSession();
  }, []);

  const handleL2Dismiss = useCallback(() => {
    setShowL2(false);
    riskEngine.recordIgnored();
    breakManager.recordOutcome(2, 'dismissed');
  }, []);

  const handleOverlayComplete = useCallback((outcome: InterventionOutcome) => {
    const level = overlayRequest?.level ?? 3;
    setOverlayRequest(null);
    if (outcome === 'completed') {
      riskEngine.recordAccepted();
      breakManager.recordOutcome(level, 'completed');
      behaviorSensor.resetSession();
    } else {
      riskEngine.recordIgnored();
      breakManager.recordOutcome(level, 'dismissed');
    }
  }, [overlayRequest]);

  // ── Context value ─────────────────────────────────────────────────────────

  const contextValue = useMemo<EyeHealthContextValue>(() => ({
    riskLevel:       riskResult.riskLevel,
    riskScore:       riskResult.riskScore,
    blinksPerMinute,
    sessionMinutes,
    isCameraActive,
    deepWorkMode,
    recommendation:  riskResult.recommendation,
    signalSource:    riskResult.signalSource,
    setDeepWorkMode,
    enableCamera,
    disableCamera,
  }), [
    riskResult,
    blinksPerMinute,
    sessionMinutes,
    isCameraActive,
    deepWorkMode,
    setDeepWorkMode,
    enableCamera,
    disableCamera,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <EyeHealthContext.Provider value={contextValue}>
      {children}

      {/* Hidden 1×1 camera — only mounted when detection is active */}
      {isCameraActive && (blinkDetectorHook as any).isActive && (blinkDetectorHook as any).device && (
        <Camera
          style={styles.hiddenCamera}
          device={(blinkDetectorHook as any).device}
          isActive
          frameProcessor={(blinkDetectorHook as any).frameProcessor}
          fps={15}
          pixelFormat="yuv"
          outputOrientation="device"
        />
      )}

      {/* Level 1 — floating pill nudge */}
      <NudgeIndicator
        visible={showNudge && !deepWorkMode}
        onTap={handleNudgeTap}
        onAutoDismiss={handleNudgeAutoDismiss}
      />

      {/* Level 2 — blink reminder popup */}
      <L2Modal
        visible={showL2 && !deepWorkMode}
        onAccept={handleL2Accept}
        onDismiss={handleL2Dismiss}
      />

      {/* Level 3 / 20-20-20 — full-screen break overlay */}
      <BreakOverlay
        visible={overlayRequest !== null}
        level={overlayRequest?.level ?? 3}
        onComplete={handleOverlayComplete}
      />
    </EyeHealthContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  // L2 Modal
  l2Backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  l2Card: {
    backgroundColor: '#1f2937',
    borderRadius: 22,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#f59e0b33',
  },
  l2Icon:        { fontSize: 44 },
  l2Title:       { fontSize: 22, fontWeight: '800', color: '#f9fafb' },
  l2Body:        { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },
  l2Buttons:     { width: '100%', gap: 10, marginTop: 4 },
  l2Accept:      { backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  l2AcceptText:  { color: '#000', fontWeight: '700', fontSize: 15 },
  l2Dismiss:     { backgroundColor: '#374151', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  l2DismissText: { color: '#9ca3af', fontSize: 14 },
});

import { create } from 'zustand';
import { SessionStats } from '../services/SessionService';
import { InterventionState } from '../services/InterventionEngine';

interface Settings {
  level1Enabled: boolean;
  level2Enabled: boolean;
  level3Enabled: boolean;
  twentyTwentyEnabled: boolean;
  hapticFeedback: boolean;
  deepWorkMode: boolean;
}

interface AppState {
  session: SessionStats | null;
  intervention: InterventionState;
  settings: Settings;
  twentyTwentyActive: boolean;
  twentyTwentySecondsLeft: number;
  exerciseActive: boolean;

  setSession: (s: SessionStats) => void;
  setIntervention: (i: InterventionState) => void;
  dismissIntervention: () => void;
  setTwentyTwenty: (active: boolean, seconds?: number) => void;
  setTwentyTwentySeconds: (s: number) => void;
  setExerciseActive: (v: boolean) => void;
  updateSettings: (partial: Partial<Settings>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  intervention: { level: 0, message: '', show: false },
  settings: {
    level1Enabled: true,
    level2Enabled: true,
    level3Enabled: true,
    twentyTwentyEnabled: true,
    hapticFeedback: true,
    deepWorkMode: false,
  },
  twentyTwentyActive: false,
  twentyTwentySecondsLeft: 20,
  exerciseActive: false,

  setSession: (session) => set({ session }),
  setIntervention: (intervention) => set({ intervention }),
  dismissIntervention: () =>
    set({ intervention: { level: 0, message: '', show: false } }),
  setTwentyTwenty: (active, seconds = 20) =>
    set({ twentyTwentyActive: active, twentyTwentySecondsLeft: seconds }),
  setTwentyTwentySeconds: (s) => set({ twentyTwentySecondsLeft: s }),
  setExerciseActive: (exerciseActive) => set({ exerciseActive }),
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
}));

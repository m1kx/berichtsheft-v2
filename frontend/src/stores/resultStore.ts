import { WeekReport } from "@/types/api";
import { create } from "zustand";

interface States {
  resultText:
    | Map<string, WeekReport>
    | null;
}

interface Actions {
  setResultText: (
    key: string,
    text: WeekReport,
  ) => void;
  removeAll: () => void;
}

export const useResultStore = create<States & Actions>((set) => ({
  resultText: null,

  setResultText: (key, value) => {
    set((state) => {
      const resultText = state.resultText ?? new Map();
      resultText.set(key, value);
      return { resultText };
    });
  },

  removeAll: () => set({ resultText: null }),
}));

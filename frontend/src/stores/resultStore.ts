import { create } from "zustand";

interface States {
  resultText: Map<string, string> | null;
}

interface Actions {
  setResultText: (key: string, text: string) => void;
  removeAll: () => void;
}

export const useResultStore = create<States & Actions>((set) => ({
  resultText: null,

  setResultText: (key, text) => {
    set((state) => {
      const resultText = state.resultText ?? new Map();
      resultText.set(key, text ?? "");
      return { resultText };
    });
  },

  removeAll: () => set({ resultText: null }),
}));

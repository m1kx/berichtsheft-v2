import { create } from "zustand";

interface States {
  logs: Array<string>;
}

interface Actions {
  addLog: (log: string) => void;
}

export const useLogStore = create<States & Actions>((set) => ({
  logs: [],

  addLog: (log: string) => {
    set((state) => ({ logs: [...state.logs, log] }));
  },
}));

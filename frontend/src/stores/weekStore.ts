import { create } from "zustand";

export interface TimeRange {
    from: Date;
    to: Date;
}

interface States {
    weeks: TimeRange[];
}

interface Actions {
    setWeeks: (weeks: TimeRange[]) => void;
}

export const useWeekStore = create<States & Actions>((set) => ({
    weeks: [],

    setWeeks: (weeks) => set({ weeks }),
}));
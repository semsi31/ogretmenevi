import { create } from 'zustand';

type FiltersState = {
  cuisine: string;
  setCuisine: (value: string) => void;
  favoriteRouteCodes: string[];
  toggleFavoriteRoute: (code: string) => void;
};

export const useFilters = create<FiltersState>((set, get) => ({
  cuisine: '',
  setCuisine: (value: string) => set({ cuisine: value }),
  favoriteRouteCodes: [],
  toggleFavoriteRoute: (code: string) => {
    const curr = get().favoriteRouteCodes;
    const exists = curr.includes(code);
    set({ favoriteRouteCodes: exists ? curr.filter((c) => c !== code) : [...curr, code] });
  },
}));



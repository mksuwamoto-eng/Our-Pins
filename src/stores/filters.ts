import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SortMode = 'recent' | 'most_vouched';

interface ViewportState {
  center: { lat: number; lng: number };
  zoom: number;
}

interface FiltersState {
  categoryIds: string[];
  prefectures: string[];
  authorIds: string[];
  sort: SortMode;
  search: string;
  showArchived: boolean;
  viewport: ViewportState;
  setCategoryIds: (ids: string[]) => void;
  setPrefectures: (ps: string[]) => void;
  setAuthorIds: (ids: string[]) => void;
  setSort: (s: SortMode) => void;
  setSearch: (q: string) => void;
  setShowArchived: (v: boolean) => void;
  setViewport: (v: ViewportState) => void;
  clear: () => void;
}

const DEFAULT_VIEWPORT: ViewportState = {
  center: { lat: 36.2048, lng: 138.2529 },
  zoom: 5,
};

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      categoryIds: [],
      prefectures: [],
      authorIds: [],
      sort: 'recent',
      search: '',
      showArchived: false,
      viewport: DEFAULT_VIEWPORT,
      setCategoryIds: (ids) => set({ categoryIds: ids }),
      setPrefectures: (ps) => set({ prefectures: ps }),
      setAuthorIds: (ids) => set({ authorIds: ids }),
      setSort: (s) => set({ sort: s }),
      setSearch: (q) => set({ search: q }),
      setShowArchived: (v) => set({ showArchived: v }),
      setViewport: (v) => set({ viewport: v }),
      clear: () =>
        set({
          categoryIds: [],
          prefectures: [],
          authorIds: [],
          sort: 'recent',
          search: '',
          showArchived: false,
        }),
    }),
    {
      name: 'our-pins:filters',
      partialize: (s) => ({
        categoryIds: s.categoryIds,
        prefectures: s.prefectures,
        authorIds: s.authorIds,
        sort: s.sort,
        viewport: s.viewport,
      }),
    },
  ),
);

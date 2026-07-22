import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HistoryItemType = "screenshot" | "recording" | "gif";

export interface HistoryItem {
  id: string;
  thumbnail: string;
  timestamp: number;
  type: HistoryItemType;
  filePath: string;
  annotated: boolean;
}

interface HistoryState {
  items: HistoryItem[];

  addItem: (item: HistoryItem) => void;
  removeItem: (id: string) => void;
  clearHistory: () => void;
  getItem: (id: string) => HistoryItem | undefined;
  updateItem: (id: string, updates: Partial<HistoryItem>) => void;
  searchItems: (query: string) => HistoryItem[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => ({
          items: [item, ...state.items],
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      clearHistory: () => set({ items: [] }),

      getItem: (id) => get().items.find((item) => item.id === id),

      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      searchItems: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().items.filter((item) =>
          item.id.toLowerCase().includes(lowerQuery) ||
          item.type.toLowerCase().includes(lowerQuery)
        );
      },
    }),
    {
      name: "snapzy-history",
      partialize: (state) => ({
        items: state.items.map((item) => ({
          ...item,
          // Only persist a truncated thumbnail reference to save storage
          thumbnail: item.thumbnail.length > 20000
            ? item.thumbnail.substring(0, 100) + "...truncated"
            : item.thumbnail,
        })),
      }),
    }
  )
);

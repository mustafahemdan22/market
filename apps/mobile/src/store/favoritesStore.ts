import { create } from "zustand";

interface FavoritesState {
  readonly favoriteIds: readonly string[];
  readonly toggleFavorite: (productId: string) => void;
  readonly isFavorite: (productId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: ["prod-1", "prod-4"], // Pre-populate with two favourites for preview

  toggleFavorite: (productId: string) => {
    set((state) => {
      const exists = state.favoriteIds.includes(productId);
      return {
        favoriteIds: exists
          ? state.favoriteIds.filter((id) => id !== productId)
          : [...state.favoriteIds, productId],
      };
    });
  },

  isFavorite: (productId: string) => {
    return get().favoriteIds.includes(productId);
  },
}));

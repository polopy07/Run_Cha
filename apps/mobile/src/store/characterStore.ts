import { create } from 'zustand';
import { apiFetch } from '../api/client';

export type Character = {
  id: number;
  characterId: number;
  name: string;
  grade: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'attack' | 'defense' | 'territory' | 'buff';
  attackLv: number;
  defenseLv: number;
  speedLv: number;
  pointLv: number;
  isDeployed: boolean;
};

type CharacterState = {
  characters: Character[];
  isLoading: boolean;

  fetchCharacters: () => Promise<void>;
  addCharacter: (character: Character) => void;
};

const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  isLoading: false,

  fetchCharacters: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch('/characters/me');
      set({ characters: data });
    } finally {
      set({ isLoading: false });
    }
  },

  addCharacter: (character) => {
    set({ characters: [...get().characters, character] });
  },
}));

export default useCharacterStore;

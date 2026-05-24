import { create } from 'zustand';
import { getCharacters } from '../api/character';

export type Character = {
  id: number;
  characterId: number;
  name: string;
  grade: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'attack' | 'defense' | 'buff';
  attackLv: number;
  defenseLv: number;
  speedLv: number;
  pointLv: number;
  isDeployed: boolean;
  deployedTerritoryId: number | null;
};

type CharacterState = {
  characters: Character[];
  isLoading: boolean;

  fetchCharacters: () => Promise<void>;
  addCharacter: (character: Character) => void;
  updateCharacter: (character: Character) => void;
};

const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  isLoading: false,

  fetchCharacters: async () => {
    set({ isLoading: true });
    try {
      const data = await getCharacters();
      set({ characters: data });
    } catch (error) {
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addCharacter: (character) => {
    set({ characters: [...get().characters, character] });
  },

  updateCharacter: (character) => {
    set({
      characters: get().characters.map((current) =>
        current.id === character.id ? character : current,
      ),
    });
  },
}));

export default useCharacterStore;

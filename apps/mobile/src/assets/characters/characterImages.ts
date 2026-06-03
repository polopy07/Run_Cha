import type { ImageSourcePropType } from 'react-native';
import type { Character } from '../../store/characterStore';

type CharacterGrade = Character['grade'];
type CharacterType = Character['type'];

const CHARACTER_IMAGES: Record<CharacterGrade, Record<CharacterType, ImageSourcePropType>> = {
  common: {
    attack: require('./common-attack.png'),
    defense: require('./common-defense.png'),
    buff: require('./common-buff.png'),
  },
  rare: {
    attack: require('./rare-attack.png'),
    defense: require('./rare-defense.png'),
    buff: require('./rare-buff.png'),
  },
  epic: {
    attack: require('./epic-attack.png'),
    defense: require('./epic-defense.png'),
    buff: require('./epic-buff.png'),
  },
  legendary: {
    attack: require('./legendary-attack.png'),
    defense: require('./legendary-defense.png'),
    buff: require('./legendary-buff.png'),
  },
};

export function getCharacterImageSource(
  grade: CharacterGrade,
  type: CharacterType,
) {
  return CHARACTER_IMAGES[grade][type];
}

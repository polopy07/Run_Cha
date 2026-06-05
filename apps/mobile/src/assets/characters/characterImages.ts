import type { ImageSourcePropType } from 'react-native';
import type { Character } from '../../store/characterStore';

type CharacterGrade = Character['grade'];
type CharacterType = Character['type'];

const CHARACTER_IMAGES: Record<
  CharacterGrade,
  Record<CharacterType, ImageSourcePropType>
> = {
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

const IMAGE_METRICS: Record<
  CharacterGrade,
  Record<CharacterType, { height: number; offsetX: number; offsetY: number }>
> = {
  common: {
    attack: { height: 432, offsetX: -31.5, offsetY: 9 },
    defense: { height: 432, offsetX: -6.5, offsetY: -1.5 },
    buff: { height: 432, offsetX: 68, offsetY: 18 },
  },
  rare: {
    attack: { height: 432, offsetX: -0.5, offsetY: 9 },
    defense: { height: 432, offsetX: 12.5, offsetY: -1.5 },
    buff: { height: 432, offsetX: 34, offsetY: 18 },
  },
  epic: {
    attack: { height: 416, offsetX: -5.5, offsetY: 2 },
    defense: { height: 416, offsetX: 14.5, offsetY: -3.5 },
    buff: { height: 416, offsetX: 13.5, offsetY: 5 },
  },
  legendary: {
    attack: { height: 454, offsetX: -5, offsetY: 3.5 },
    defense: { height: 454, offsetX: 14.5, offsetY: -3.5 },
    buff: { height: 454, offsetX: 13.5, offsetY: 23 },
  },
};

export function getCharacterImageSource(
  grade: CharacterGrade,
  type: CharacterType,
) {
  return CHARACTER_IMAGES[grade][type];
}

export function getCharacterImageTransform(
  grade: CharacterGrade,
  type: CharacterType,
  displayHeight: number,
) {
  const metrics = IMAGE_METRICS[grade][type];
  const scale = displayHeight / metrics.height;

  return [
    { translateX: -metrics.offsetX * scale },
    { translateY: -metrics.offsetY * scale },
  ];
}

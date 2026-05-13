import { Text, View } from 'react-native';

type GachaResultProps = {
  characterName?: string;
};

export function GachaResult({ characterName }: GachaResultProps) {
  return (
    <View>
      <Text>{characterName ?? 'No result'}</Text>
    </View>
  );
}

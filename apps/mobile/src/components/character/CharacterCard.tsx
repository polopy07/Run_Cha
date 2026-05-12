import { Text, View } from 'react-native';

type CharacterCardProps = {
  name: string;
};

export function CharacterCard({ name }: CharacterCardProps) {
  return (
    <View>
      <Text>{name}</Text>
    </View>
  );
}

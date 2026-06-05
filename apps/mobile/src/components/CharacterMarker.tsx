import React from 'react';
import { View, Text, Image } from 'react-native';
import { Marker } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import type { OnlineUser } from '../hooks/useSocket';
import {
  getCharacterImageSource,
  getCharacterImageTransform,
} from '../assets/characters/characterImages';

const GRADE_BORDER: Record<string, string> = {
  common: '#9E9E9E',
  rare: '#42A5F5',
  epic: '#AB47BC',
  legendary: '#FFA726',
};

type Props = {
  user: OnlineUser;
  isMe?: boolean;
};

export function CharacterMarker({ user, isMe }: Props) {
  const { colors } = useTheme();
  const char = user.character;
  const size = isMe ? 24 : 40;
  const borderColor = char ? GRADE_BORDER[char.grade] ?? colors.textMuted : colors.textMuted;

  return (
    <Marker
      coordinate={{ latitude: user.lat, longitude: user.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: isMe ? 3 : 2,
          borderColor: isMe ? colors.primary : borderColor,
          backgroundColor: colors.card,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}>
          {char ? (
            <Image
              source={getCharacterImageSource(char.grade, char.type)}
              style={{
                width: size,
                height: size,
                transform: getCharacterImageTransform(char.grade, char.type, size),
              }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontSize: isMe ? 18 : 14, fontWeight: '800', color: colors.text }}>
              {user.nickname[0] || '?'}
            </Text>
          )}
        </View>
        <View style={{
          backgroundColor: isMe ? colors.primary : colors.card,
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 1,
          marginTop: 2,
        }}>
          <Text style={{
            fontSize: 9,
            fontWeight: '700',
            color: isMe ? colors.bg : colors.text,
          }} numberOfLines={1}>
            {user.nickname}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

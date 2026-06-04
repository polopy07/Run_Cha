import React from 'react';
import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { useTheme } from '../contexts/ThemeContext';
import type { OnlineUser } from '../hooks/useSocket';

const GRADE_BORDER: Record<string, string> = {
  common: '#9E9E9E',
  rare: '#42A5F5',
  epic: '#AB47BC',
  legendary: '#FFA726',
};

const TYPE_ICON: Record<string, string> = {
  attack: '⚔',
  defense: '🛡',
  buff: '✦',
};

type Props = {
  user: OnlineUser;
  isMe?: boolean;
};

export function CharacterMarker({ user, isMe }: Props) {
  const { colors } = useTheme();
  const char = user.character;
  const borderColor = char ? GRADE_BORDER[char.grade] ?? colors.textMuted : colors.textMuted;

  return (
    <Marker
      coordinate={{ latitude: user.lat, longitude: user.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: isMe ? 48 : 40,
          height: isMe ? 48 : 40,
          borderRadius: isMe ? 24 : 20,
          borderWidth: isMe ? 3 : 2,
          borderColor: isMe ? colors.primary : borderColor,
          backgroundColor: colors.card,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {char ? (
            <Text style={{ fontSize: isMe ? 20 : 16 }}>
              {TYPE_ICON[char.type] ?? '?'}
            </Text>
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

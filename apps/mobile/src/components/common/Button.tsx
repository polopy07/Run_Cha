import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { radius } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_PADDING = { sm: 10, md: 14, lg: 18 };
const SIZE_FONT = { sm: 13, md: 15, lg: 17 };

export function Button({
  label, onPress, variant = 'primary', disabled = false,
  loading = false, style, textStyle, size = 'md',
}: ButtonProps) {
  const { colors } = useTheme();

  const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string }> = {
    primary:   { bg: colors.primary, text: colors.bg },
    secondary: { bg: colors.card, text: colors.text },
    danger:    { bg: colors.danger, text: '#fff' },
    ghost:     { bg: 'transparent', text: colors.primary },
  };

  const v = VARIANT_STYLES[variant];

  return (
    <TouchableOpacity
      style={[
        {
          borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
          backgroundColor: v.bg, paddingVertical: SIZE_PADDING[size],
        },
        disabled && { opacity: 0.4 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[{ fontWeight: '700', color: v.text, fontSize: SIZE_FONT[size] }, textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

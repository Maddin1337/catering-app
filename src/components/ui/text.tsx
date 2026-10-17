import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { textStyles, tokens, type TextVariant } from '@/theme/tokens';

type ColorToken = 'text' | 'textSecondary' | 'textTertiary' | 'accent' | 'danger' | 'onAccent';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  /** Tabellarische Ziffern für Beträge und Mengen. */
  tabular?: boolean;
};

// Setzt bewusst kein `fontWeight`: Das Gewicht steckt in der Schriftfamilie (siehe tokens.font).
export function Text({ variant = 'body', color = 'text', tabular, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        textStyles[variant],
        { color: tokens.color[color] },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}

import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { tints, tokens, type Tint } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { surfaceStyle } from './surface';
import { Text } from './text';

/**
 * Gruppierte Liste im iOS-Stil: eine Karte, darin Zeilen mit feinen Trennlinien. Ruhiger und
 * kompakter als einzelne Karten; ideal für Einstellungen, Menüs und Stammdaten.
 */
export function ListGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="caption" color="textSecondary" style={styles.title}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[surfaceStyle('card'), styles.card]}>
        {rows.map((row, i) => (
          <View key={row.key ?? i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? (
        <Text variant="small" color="textTertiary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** Zeile einer `ListGroup`: farbige Symbol-Kachel, Titel, optional Untertitel und Wert rechts. */
export function GroupRow({
  icon: Icon,
  tint = 'slate',
  title,
  subtitle,
  value,
  right,
  onPress,
  destructive,
}: {
  icon?: LucideIcon;
  tint?: Tint;
  title: string;
  subtitle?: string;
  /** Kurzer Wert rechts (z. B. „Netto“, „3“). */
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      {Icon ? (
        <View
          style={[
            styles.icon,
            { backgroundColor: destructive ? tokens.color.dangerSubtle : tints[tint].bg },
          ]}
        >
          <Icon
            color={destructive ? tokens.color.danger : tints[tint].fg}
            size={18}
            strokeWidth={2.2}
          />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text variant="bodyStrong" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" color="textTertiary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !destructive ? (
        <ChevronRight color={tokens.color.textTertiary} size={18} strokeWidth={2.2} />
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      scale={0.985}
      pressedStyle={{ backgroundColor: tokens.color.bgSubtle }}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.space[2] },
  title: { paddingHorizontal: tokens.space[4], letterSpacing: 0.6 },
  card: { overflow: 'hidden' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.border,
    marginLeft: 60,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  value: { maxWidth: '40%' },
  footer: { paddingHorizontal: tokens.space[4] },
});

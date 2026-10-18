import { ChevronLeft, Ellipsis, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  SlideInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { ActionSheet, type SheetAction } from './action-sheet';
import { BrandMark } from './brand-mark';
import { IconButton } from './icon-button';
import { Text } from './text';

// Höhe der Kopfleiste unter dem sicheren Bereich.
export const HEADER_HEIGHT = 56;
// Scrollstrecke, über die der große Titel aus- und der kleine Titel einblendet.
const TITLE_FADE = 44;

/**
 * Seitenrahmen der App. Oben eine kompakte Kopfleiste (rund: Zurück links, Aktionen und „⋯“
 * rechts), darunter der große Titel. Beim Scrollen wandert der Titel in die Leiste, die
 * Leiste bekommt einen milchigen Hintergrund. `footer` bleibt als Aktionsleiste unten in
 * Daumenreichweite stehen.
 */
export function Screen({
  title,
  subtitle,
  onBack,
  backLabel = 'Zurück',
  backIcon = 'back',
  brand,
  actions,
  menu,
  menuLabel = 'Weitere Aktionen',
  footer,
  onRefresh,
  refreshing = false,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Zeigt links den runden Zurück-Knopf (Detailseiten außerhalb der Tabs). */
  onBack?: () => void;
  backLabel?: string;
  /** „close“ zeigt ein ✕ statt des Pfeils (Anlegen-Seiten). */
  backIcon?: 'back' | 'close';
  /** Zeigt die Marken-Plakette über dem Titel (Anmeldeseiten). */
  brand?: boolean;
  /** Rechte Seite der Kopfleiste, z. B. ein `IconButton` zum Anlegen. */
  actions?: ReactNode;
  /** Seltenere Aktionen hinter „⋯“; öffnen sich als Blatt von unten. */
  menu?: SheetAction[];
  menuLabel?: string;
  /** Feste Leiste am unteren Rand (Speichern, nächster Schritt). */
  footer?: ReactNode;
  /** Ziehen zum Aktualisieren. */
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const largeTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, TITLE_FADE], [1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(scrollY.get(), [-80, 0], [12, 0], 'clamp') },
      { scale: interpolate(scrollY.get(), [-120, 0], [1.06, 1], 'clamp') },
    ],
  }));
  const smallTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [TITLE_FADE * 0.6, TITLE_FADE * 1.3], [0, 1], 'clamp'),
    transform: [
      {
        translateY: interpolate(
          scrollY.get(),
          [TITLE_FADE * 0.6, TITLE_FADE * 1.3],
          [6, 0],
          'clamp',
        ),
      },
    ],
  }));
  const chrome = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 16], [0, 1], 'clamp'),
  }));

  const hasMenu = !!menu && menu.length > 0;
  const top = insets.top + HEADER_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.ScrollView
        style={styles.flex}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.color.accent}
              colors={[tokens.color.accent]}
              progressViewOffset={top}
            />
          ) : undefined
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: top,
            paddingBottom: footer ? tokens.space[4] : insets.bottom + tokens.space[8],
          },
        ]}
      >
        <View style={styles.column}>
          {brand ? <BrandMark /> : null}
          <Animated.View style={[styles.header, largeTitle]}>
            <Text variant={title.length > 30 ? 'title1' : 'display'} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color="textSecondary">
                {subtitle}
              </Text>
            ) : null}
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(tokens.motion.slow)} style={styles.body}>
            {children}
          </Animated.View>
        </View>
      </Animated.ScrollView>

      <View style={[styles.bar, { paddingTop: insets.top, height: top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.chrome, chrome]} />
        <View style={styles.barRow} pointerEvents="box-none">
          <View style={styles.side}>
            {onBack ? (
              <IconButton
                icon={backIcon === 'close' ? X : ChevronLeft}
                label={backLabel}
                onPress={onBack}
              />
            ) : null}
          </View>
          <Animated.View style={[styles.barTitle, smallTitle]} pointerEvents="none">
            <Text variant="bodyStrong" numberOfLines={1} style={styles.barTitleText}>
              {title}
            </Text>
          </Animated.View>
          <View style={[styles.side, styles.sideRight]}>
            {actions}
            {hasMenu ? (
              <IconButton icon={Ellipsis} label={menuLabel} onPress={() => setMenuOpen(true)} />
            ) : null}
          </View>
        </View>
      </View>

      {footer ? (
        <Animated.View
          entering={SlideInDown.springify().damping(tokens.motion.springSoft.damping)}
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, tokens.space[3]) }]}
        >
          <View style={styles.footerInner}>{footer}</View>
        </Animated.View>
      ) : null}

      {menuOpen && menu ? <ActionSheet actions={menu} onClose={() => setMenuOpen(false)} /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.color.canvas },
  content: { flexGrow: 1, paddingHorizontal: tokens.space[4], alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: tokens.space[5] },
  header: { gap: tokens.space[1], paddingTop: tokens.space[1], transformOrigin: 'left' },
  body: { gap: tokens.space[5] },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  chrome: {
    backgroundColor: tokens.color.chrome,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.hairline,
    ...Platform.select({
      web: { backdropFilter: 'saturate(180%) blur(16px)' } as object,
      default: {},
    }),
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.space[4],
    gap: tokens.space[2],
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  sideRight: { marginLeft: 'auto' },
  // Mittig über der ganzen Breite, links und rechts Platz für je zwei runde Knöpfe.
  barTitle: { position: 'absolute', left: 116, right: 116, alignItems: 'center' },
  barTitleText: { textAlign: 'center' },
  footer: {
    paddingTop: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    backgroundColor: tokens.color.chrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.hairline,
    alignItems: 'center',
    ...Platform.select({
      web: { backdropFilter: 'saturate(180%) blur(16px)' } as object,
      default: {},
    }),
  },
  footerInner: { width: '100%', maxWidth: 560, flexDirection: 'row', gap: tokens.space[2] },
});

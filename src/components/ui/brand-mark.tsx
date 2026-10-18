import { ChefHat } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { tokens } from '@/theme/tokens';

/** Marken-Plakette für Anmelde- und Willkommensseiten (Platzhalter bis zum finalen Logo). */
export function BrandMark() {
  return (
    <LinearGradient
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      colors={[tokens.color.accentGradientFrom, tokens.color.accentGradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.mark}
    >
      <ChefHat color={tokens.color.onAccent} size={28} strokeWidth={2} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: tokens.shadow.accent,
  },
});

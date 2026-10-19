import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Answer, Question } from '@/lib/intake';
import { tokens } from '@/theme/tokens';

import { sectionOf } from '../flow';
import { StepInput } from './step-input';

// Diese Typen antworten mit dem Antippen selbst; alle anderen brauchen „Weiter“.
const INSTANT = ['single_choice', 'boolean', 'customer'];

/**
 * Eine Frage pro Bildschirm: kleine Überschrift (Bereich), die Frage groß, ein Hilfetext, darunter die
 * Antwort. Fest unten „Weiter“ (erst aktiv, wenn die Antwort gültig ist) und bei freiwilligen Fragen
 * „Überspringen“. Der Schritt gleitet von rechts herein, beim Zurückgehen von links.
 */
export function QuestionStep({
  question,
  initial,
  direction,
  onSubmit,
  onSkip,
}: {
  question: Question;
  initial?: Answer;
  direction: 'forward' | 'back';
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Answer | null>(
    Array.isArray(initial) && initial.length === 0 ? null : (initial ?? null),
  );
  const instant = INSTANT.includes(question.answer_type);
  const entering = (direction === 'back' ? FadeInLeft : FadeInRight).duration(tokens.motion.base);

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={entering} style={styles.step}>
          <View style={styles.head}>
            <Text variant="caption" color="accent" style={styles.eyebrow}>
              {t(`intake.chat.section.${sectionOf(question)}`)}
            </Text>
            <Text variant="display" accessibilityRole="header" style={styles.title}>
              {question.prompt}
            </Text>
            {question.help_text ? (
              <Text variant="body" color="textSecondary">
                {question.help_text}
              </Text>
            ) : null}
          </View>
          <StepInput question={question} initial={initial} onDraft={setDraft} onCommit={onSubmit} />
        </Animated.View>
      </ScrollView>

      {!instant || onSkip ? (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, tokens.space[3]) }]}>
          {!instant ? (
            <Button
              label={t('intake.chat.next')}
              disabled={draft === null}
              onPress={() => draft !== null && onSubmit(draft)}
            />
          ) : null}
          {onSkip ? (
            <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} />
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    padding: tokens.space[5],
    paddingTop: tokens.space[4],
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  step: { gap: tokens.space[6] },
  head: { gap: tokens.space[2] },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.9 },
  title: { fontSize: 28, lineHeight: 36 },
  bar: {
    gap: tokens.space[1],
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[3],
    backgroundColor: tokens.color.chrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.hairline,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});

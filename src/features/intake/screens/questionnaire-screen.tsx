import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { confirm } from '@/lib/confirm';
import { DIETS } from '@/lib/dietary';
import { toAppError } from '@/lib/errors';
import {
  COMPATIBLE,
  targetsFor,
  validateQuestion,
  type AnswerType,
  type ShowIf,
  type Target,
} from '@/lib/intake';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import {
  useArchiveQuestion,
  useIntakeQuestions,
  useResetQuestions,
  useSaveQuestion,
  useSwapQuestions,
  type QuestionInput,
  type StoredQuestion,
} from '../api';

const TYPES: AnswerType[] = [
  'single_choice',
  'multi_choice',
  'number',
  'date',
  'time',
  'time_range',
  'datetime',
  'text',
  'boolean',
  'customer',
];
const OPERATORS: ShowIf['operator'][] = ['equals', 'not_equals', 'in', 'gt', 'lt', 'is_true'];

type Editing = { mode: 'new' } | { mode: 'edit'; row: StoredQuestion };

/** SC-64 Fragenkatalog mit SC-65 Frage bearbeiten: deine Fragen für den Angebots-Chat. */
export function QuestionnaireScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const list = useIntakeQuestions();
  const swap = useSwapQuestions();
  const reset = useResetQuestions();
  const [editing, setEditing] = useState<Editing | null>(null);

  const active = (list.data ?? []).filter((q) => !q.archived_at);
  const error = list.error ?? swap.error ?? reset.error;

  const describe = (q: StoredQuestion): string => {
    const parts = [
      t(`intake.type.${q.answer_type}`),
      q.target ? t(`intake.target.${q.target}`) : t('intake.noTarget'),
      q.is_required ? t('intake.required') : null,
    ];
    if (q.show_if) {
      const ref = active.find((x) => x.id === q.show_if!.question_id);
      parts.push(
        ref
          ? t('intake.onlyIf', {
              question: ref.prompt,
              op: t(`intake.operator.${q.show_if.operator}`),
              value: String(q.show_if.value ?? ''),
            }).trim()
          : null,
      );
    }
    return parts.filter(Boolean).join(' · ');
  };

  // Reihenfolge prüfen: jede Bedingung muss auf eine frühere Frage zeigen
  const move = (idx: number, dir: -1 | 1) => {
    const a = active[idx];
    const b = active[idx + dir];
    if (!a || !b) return;
    const after = active.map((q) =>
      q.id === a.id
        ? { ...q, sort_order: b.sort_order }
        : q.id === b.id
          ? { ...q, sort_order: a.sort_order }
          : q,
    );
    const bad = after.some(
      (q) => q.show_if && validateQuestion(q, after).includes('show_if_invalid'),
    );
    if (bad) return;
    swap.mutate({
      a: { id: a.id, sort_order: a.sort_order },
      b: { id: b.id, sort_order: b.sort_order },
    });
  };

  const restore = async () => {
    if (
      await confirm(
        t('intake.resetTitle'),
        t('intake.resetBody'),
        t('intake.reset'),
        t('common.cancel'),
      )
    )
      reset.mutate();
  };

  return (
    <Screen
      title={t('intake.title')}
      subtitle={t('intake.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {editing ? (
        <QuestionForm
          key={editing.mode === 'edit' ? editing.row.id : 'new'}
          editing={editing}
          all={active}
          onClose={() => setEditing(null)}
        />
      ) : (
        <>
          <Button label={t('intake.add')} onPress={() => setEditing({ mode: 'new' })} />
          <Button
            label={t('intake.test')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/events/intake', params: { test: '1' } })}
          />
          <View style={{ gap: 8 }}>
            {active.map((q, i) => (
              <View key={q.id} style={{ gap: 4 }}>
                <ListRow
                  title={`${i + 1}. ${q.prompt}`}
                  subtitle={describe(q)}
                  onPress={() => setEditing({ mode: 'edit', row: q })}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label={t('catalog.package.up')}
                    variant="ghost"
                    disabled={i === 0}
                    onPress={() => move(i, -1)}
                  />
                  <Button
                    label={t('catalog.package.down')}
                    variant="ghost"
                    disabled={i === active.length - 1}
                    onPress={() => move(i, 1)}
                  />
                </View>
              </View>
            ))}
          </View>
          <Button
            label={t('intake.reset')}
            variant="danger"
            loading={reset.isPending}
            onPress={() => void restore()}
          />
        </>
      )}
    </Screen>
  );
}

function QuestionForm({
  editing,
  all,
  onClose,
}: {
  editing: Editing;
  all: StoredQuestion[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveQuestion();
  const archive = useArchiveQuestion();
  const row = editing.mode === 'edit' ? editing.row : null;
  const nextOrder = (all.at(-1)?.sort_order ?? 0) + 10;

  const [prompt, setPrompt] = useState(row?.prompt ?? '');
  const [help, setHelp] = useState(row?.help_text ?? '');
  const [type, setType] = useState<AnswerType>(row?.answer_type ?? 'text');
  const [optionsText, setOptionsText] = useState(
    (row?.options ?? []).map((o) => o.label).join('\n'),
  );
  const [required, setRequired] = useState(row?.is_required ?? false);
  const [target, setTarget] = useState<Target | ''>(row?.target ?? '');
  const [diet, setDiet] = useState<string>(row?.target_config?.diet ?? '');
  const [condQuestion, setCondQuestion] = useState<string>(row?.show_if?.question_id ?? '');
  const [operator, setOperator] = useState<ShowIf['operator']>(row?.show_if?.operator ?? 'equals');
  const [condValue, setCondValue] = useState<string>(
    row?.show_if?.value !== undefined ? String(row.show_if.value) : '',
  );
  const [tried, setTried] = useState(false);

  const sortOrder = row?.sort_order ?? nextOrder;
  const earlier = all.filter((q) => q.sort_order < sortOrder && q.id !== row?.id);
  const refQuestion = earlier.find((q) => q.id === condQuestion);
  const isChoice = type === 'single_choice' || type === 'multi_choice';
  const options = isChoice
    ? optionsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label) => ({ value: label, label }))
    : [];

  const targets = targetsFor(type);
  const targetValue: Target | null = target && COMPATIBLE[target].includes(type) ? target : null;

  const cond: ShowIf | null = condQuestion
    ? {
        question_id: condQuestion,
        operator,
        ...(operator === 'is_true'
          ? {}
          : {
              value:
                operator === 'gt' || operator === 'lt'
                  ? Number(condValue.replace(',', '.'))
                  : operator === 'in'
                    ? condValue
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : condValue.trim(),
            }),
      }
    : null;

  const values: QuestionInput = {
    sort_order: sortOrder,
    prompt,
    help_text: help.trim() || null,
    answer_type: type,
    options,
    is_required: required,
    target: targetValue,
    target_config: targetValue === 'dietary_requirements' && diet ? { diet } : null,
    show_if: cond,
  };
  const problems = validateQuestion({ ...values, id: row?.id }, all);
  const condValueMissing =
    !!cond &&
    operator !== 'is_true' &&
    (condValue.trim() === '' ||
      ((operator === 'gt' || operator === 'lt') && Number.isNaN(cond.value)));
  const hasProblems = problems.length > 0 || condValueMissing;

  const submit = () => {
    setTried(true);
    if (hasProblems) return;
    save.mutate({ id: row?.id, values }, { onSuccess: onClose });
  };
  const remove = async () => {
    if (!row) return;
    if (
      await confirm(
        t('intake.archiveTitle'),
        t('intake.archiveBody'),
        t('intake.archive'),
        t('common.cancel'),
      )
    ) {
      archive.mutate(row.id, { onSuccess: onClose });
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {save.error ? <Banner tone="danger">{toAppError(save.error).message}</Banner> : null}
      <TextField
        label={t('intake.form.prompt')}
        value={prompt}
        onChangeText={setPrompt}
        error={
          tried && problems.includes('prompt_missing')
            ? t('intake.problems.prompt_missing')
            : undefined
        }
        maxLength={200}
        multiline
      />
      <TextField label={t('intake.form.help')} value={help} onChangeText={setHelp} />
      <RadioList
        label={t('intake.form.type')}
        value={type}
        onChange={setType}
        options={TYPES.map((x) => ({ value: x, label: t(`intake.type.${x}`) }))}
      />
      {isChoice ? (
        <TextField
          label={t('intake.form.options')}
          helper={t('intake.form.optionsHint')}
          value={optionsText}
          onChangeText={setOptionsText}
          multiline
          error={
            tried && problems.includes('options_missing')
              ? t('intake.problems.options_missing')
              : undefined
          }
        />
      ) : null}
      <Checkbox label={t('intake.form.required')} checked={required} onChange={setRequired} />

      <RadioList
        label={t('intake.form.target')}
        value={targetValue ?? ''}
        onChange={(v) => setTarget(v as Target | '')}
        options={[
          { value: '', label: t('intake.noTarget'), hint: t('intake.form.noTargetHint') },
          ...targets.map((x) => ({
            value: x as string,
            label: t(`intake.target.${x}`),
            hint: t(`intake.targetHint.${x}`),
          })),
        ]}
      />
      {targetValue === 'dietary_requirements' ? (
        <View style={{ gap: 8 }}>
          <Text variant="small" color="textSecondary">
            {t('intake.form.diet')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DIETS.map((d) => (
              <Chip
                key={d}
                label={t(`diet.${d}`)}
                selected={diet === d}
                onPress={() => setDiet(diet === d ? '' : d)}
              />
            ))}
          </View>
          {tried && problems.includes('diet_missing') ? (
            <Text variant="small" color="danger">
              {t('intake.problems.diet_missing')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          gap: 8,
          padding: tokens.space[3],
          ...surfaceStyle(),
        }}
      >
        <Text variant="title2">{t('intake.form.condition')}</Text>
        <Text variant="small" color="textSecondary">
          {t('intake.form.conditionHint')}
        </Text>
        <RadioList
          label={t('intake.form.conditionQuestion')}
          value={condQuestion}
          onChange={setCondQuestion}
          options={[
            { value: '', label: t('intake.form.always') },
            ...earlier.map((q) => ({ value: q.id, label: q.prompt })),
          ]}
        />
        {condQuestion ? (
          <>
            <RadioList
              label={t('intake.form.operator')}
              value={operator}
              onChange={setOperator}
              options={OPERATORS.map((o) => ({ value: o, label: t(`intake.operator.${o}`) }))}
            />
            {operator !== 'is_true' ? (
              refQuestion &&
              (refQuestion.answer_type === 'single_choice' ||
                refQuestion.answer_type === 'multi_choice') &&
              operator !== 'in' ? (
                <RadioList
                  label={t('intake.form.value')}
                  value={condValue}
                  onChange={setCondValue}
                  options={refQuestion.options.map((o) => ({ value: o.value, label: o.label }))}
                />
              ) : (
                <TextField
                  label={t('intake.form.value')}
                  helper={operator === 'in' ? t('intake.form.valueInHint') : undefined}
                  value={condValue}
                  onChangeText={setCondValue}
                  error={tried && condValueMissing ? t('intake.problems.value_missing') : undefined}
                />
              )
            ) : null}
          </>
        ) : null}
        {tried && problems.includes('show_if_invalid') ? (
          <Text variant="small" color="danger">
            {t('intake.problems.show_if_invalid')}
          </Text>
        ) : null}
      </View>

      <Button label={t('common.save')} loading={save.isPending} onPress={submit} />
      {row ? (
        <Button
          label={t('intake.archive')}
          variant="danger"
          loading={archive.isPending}
          onPress={() => void remove()}
        />
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
    </View>
  );
}

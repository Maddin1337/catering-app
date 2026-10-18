import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import type { Question } from '@/lib/intake';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';

// Einziger Ort für Supabase-Aufrufe des Angebots-Chats (docs/05 §3.2). Nur admin.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

export type StoredQuestion = Question & { archived_at: string | null };

export function useIntakeQuestions() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['intake', 'questions', m?.company_id],
    enabled: m?.role === 'admin',
    queryFn: async (): Promise<StoredQuestion[]> => {
      const { data, error } = await client()
        .from('intake_questions')
        .select(
          'id, sort_order, prompt, help_text, answer_type, options, is_required, target, target_config, show_if, archived_at',
        )
        .order('sort_order');
      if (error) throw toAppError(error);
      return (data ?? []) as StoredQuestion[];
    },
  });
}

export type QuestionInput = Omit<Question, 'id'>;

function useIntakeMutation<V, R = void>(fn: (v: V, companyId: string) => Promise<R>) {
  const queryClient = useQueryClient();
  const companyId = useMembership().data?.company_id;
  return useMutation({
    mutationFn: (v: V) => fn(v, companyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['intake'] }),
  });
}

export const useSaveQuestion = () =>
  useIntakeMutation(async (v: { id?: string; values: QuestionInput }, companyId) => {
    const row = {
      sort_order: v.values.sort_order,
      prompt: v.values.prompt.trim(),
      help_text: v.values.help_text?.trim() || null,
      answer_type: v.values.answer_type,
      options: v.values.options,
      is_required: v.values.is_required,
      target: v.values.target,
      target_config: v.values.target_config,
      show_if: v.values.show_if,
    };
    if (v.id) {
      const { error } = await client().from('intake_questions').update(row).eq('id', v.id);
      if (error) throw toAppError(error);
    } else {
      const { error } = await client()
        .from('intake_questions')
        .insert({ company_id: companyId, ...row });
      if (error) throw toAppError(error);
    }
  });

export const useArchiveQuestion = () =>
  useIntakeMutation(async (id: string) => {
    const { error } = await client()
      .from('intake_questions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw toAppError(error);
  });

/** Zwei Fragen tauschen ihre Position. */
export const useSwapQuestions = () =>
  useIntakeMutation(
    async (v: { a: { id: string; sort_order: number }; b: { id: string; sort_order: number } }) => {
      const first = await client()
        .from('intake_questions')
        .update({ sort_order: v.b.sort_order })
        .eq('id', v.a.id);
      if (first.error) throw toAppError(first.error);
      const second = await client()
        .from('intake_questions')
        .update({ sort_order: v.a.sort_order })
        .eq('id', v.b.id);
      if (second.error) throw toAppError(second.error);
    },
  );

export const useResetQuestions = () =>
  useIntakeMutation(async (_: void) => {
    const { error } = await client().rpc('reset_intake_questions');
    if (error) throw toAppError(error);
  });

export type IntakePayload = {
  event_id?: string;
  customer: { id: string } | { name: string; type: 'business' | 'private' };
  event: Record<string, unknown>;
  dietary: Record<string, unknown>[];
  intake_answers: unknown[];
};

/** Abschluss des Chats: Kunde (falls neu), Anfrage, Sonderessen, Notizen und Antworten in einer Transaktion. */
export function useCreateEventFromIntake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IntakePayload): Promise<string> => {
      const { data, error } = await client().rpc('create_event_from_intake', { p: payload });
      if (error) throw toAppError(error);
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

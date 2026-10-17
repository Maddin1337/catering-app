import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';

import {
  useArchiveQualification,
  useCreateQualification,
  useQualificationList,
  useRenameQualification,
} from '../api';
import type { QualificationRow } from '../types';

type Editing = { mode: 'new' } | { mode: 'edit'; row: QualificationRow };

/** SC-61 Qualifikationen: anlegen, umbenennen, archivieren. Archivierte verschwinden aus Auswahllisten. */
export function QualificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const list = useQualificationList();
  const create = useCreateQualification();
  const rename = useRenameQualification();
  const archive = useArchiveQualification();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);

  const error = list.error ?? create.error ?? rename.error ?? archive.error;
  const nameError =
    name.trim() === '' || name.trim().length > 60
      ? t('settings.qualifications.nameError')
      : undefined;

  const open = (e: Editing) => {
    create.reset();
    rename.reset();
    setTried(false);
    setName(e.mode === 'edit' ? e.row.name : '');
    setEditing(e);
  };
  const close = { onSuccess: () => setEditing(null) };

  const save = () => {
    setTried(true);
    if (nameError || !editing) return;
    if (editing.mode === 'new') create.mutate(name, close);
    else rename.mutate({ id: editing.row.id, name }, close);
  };

  const remove = async () => {
    if (editing?.mode !== 'edit') return;
    const ok = await confirm(
      t('settings.qualifications.archiveTitle', { name: editing.row.name }),
      t('settings.qualifications.archiveBody'),
      t('settings.qualifications.archive'),
      t('common.cancel'),
    );
    if (ok) archive.mutate(editing.row.id, close);
  };

  return (
    <Screen
      title={t('settings.qualifications.title')}
      subtitle={t('settings.qualifications.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {editing ? (
        <View style={{ gap: 16 }}>
          <TextField
            label={t('settings.qualifications.name')}
            value={name}
            onChangeText={setName}
            error={tried ? nameError : undefined}
            maxLength={60}
            autoCapitalize="words"
          />
          <Button
            label={t('common.save')}
            loading={create.isPending || rename.isPending}
            onPress={save}
          />
          {editing.mode === 'edit' ? (
            <Button
              label={t('settings.qualifications.archive')}
              variant="danger"
              loading={archive.isPending}
              onPress={() => void remove()}
            />
          ) : null}
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(null)} />
        </View>
      ) : (
        <>
          <Button label={t('settings.qualifications.add')} onPress={() => open({ mode: 'new' })} />
          <View style={{ gap: 8 }}>
            {(list.data ?? []).map((q) => (
              <ListRow
                key={q.id}
                title={q.name}
                subtitle={t('settings.qualifications.members', { count: q.memberCount })}
                onPress={() => open({ mode: 'edit', row: q })}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

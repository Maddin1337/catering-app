import { Copy, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';

import type { TaxRate } from '../../company/types';
import { buildItem, draftFrom, type ItemDraft } from '../item-draft';
import type { EditorItem } from '../types';
import { ItemFields } from './item-fields';

/** Position bearbeiten als Blatt von unten; Duplizieren und Entfernen stehen unter den Feldern. */
export function ItemSheet({
  item,
  rates,
  suggestion,
  entryLabel,
  guests,
  onSave,
  onDuplicate,
  onRemove,
  onClose,
}: {
  item: EditorItem;
  rates: TaxRate[];
  suggestion: number | null;
  entryLabel: string;
  guests: number | null;
  onSave: (item: EditorItem) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ItemDraft>(() => draftFrom(item));
  const [tried, setTried] = useState(false);

  const save = (close: (then?: () => void) => void) => {
    setTried(true);
    const next = buildItem(item, draft);
    if (next) close(() => onSave(next));
  };

  return (
    <Sheet
      title={item.is_heading ? t('quote.heading') : t(`quote.type.${item.type}`)}
      onClose={onClose}
      footer={(close) => <Button label={t('quote.item.apply')} onPress={() => save(close)} />}
    >
      {(close) => (
        <>
          <ItemFields
            item={item}
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            showErrors={tried}
            rates={rates}
            suggestion={suggestion}
            entryLabel={entryLabel}
            guests={guests}
          />
          <View style={styles.actions}>
            <Button
              label={t('quote.item.duplicate')}
              icon={Copy}
              variant="secondary"
              style={styles.action}
              onPress={() => close(onDuplicate)}
            />
            <Button
              label={t('quote.item.remove')}
              icon={Trash2}
              variant="danger"
              style={styles.action}
              onPress={() => close(onRemove)}
            />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1 },
});

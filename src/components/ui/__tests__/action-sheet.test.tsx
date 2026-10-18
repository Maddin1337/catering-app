import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ActionSheet } from '../action-sheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('ActionSheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('schließt erst und führt danach die gewählte Aktion aus', async () => {
    const onClose = jest.fn();
    const copy = jest.fn();
    await render(
      <ActionSheet
        title="Mehr"
        onClose={onClose}
        actions={[
          { label: 'Kopieren', onPress: copy },
          { label: 'Löschen', onPress: jest.fn(), destructive: true },
        ]}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Kopieren' }));
    // Während das Blatt hinausgleitet, ist noch nichts passiert.
    expect(copy).not.toHaveBeenCalled();
    await act(() => jest.runAllTimers());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it('nimmt während des Schließens keine zweite Aktion an', async () => {
    const onClose = jest.fn();
    const copy = jest.fn();
    await render(
      <ActionSheet onClose={onClose} actions={[{ label: 'Kopieren', onPress: copy }]} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Kopieren' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kopieren' }));
    await act(() => jest.runAllTimers());
    expect(copy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

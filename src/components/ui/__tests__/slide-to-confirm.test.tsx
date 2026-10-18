import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SlideToConfirm } from '../slide-to-confirm';

describe('SlideToConfirm', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('bestätigt ohne Schiebegeste über die Standardaktion – erst nach dem Entfalten', async () => {
    const onConfirm = jest.fn();
    await render(<SlideToConfirm label="Absagen" onConfirm={onConfirm} />);
    const slider = screen.getByRole('button', { name: 'Absagen' });

    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onConfirm).not.toHaveBeenCalled();
    await act(() => jest.runAllTimers());
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Bestätigt ist bestätigt: ein zweites Auslösen bleibt folgenlos.
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await act(() => jest.runAllTimers());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lässt sich wieder schieben, wenn die Aktion nicht startet', async () => {
    const onConfirm = jest.fn(() => false);
    await render(<SlideToConfirm label="Bestätigen" onConfirm={onConfirm} />);
    const slider = screen.getByRole('button', { name: 'Bestätigen' });

    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await act(() => jest.runAllTimers());
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await act(() => jest.runAllTimers());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('tut nichts, solange er gesperrt ist', async () => {
    const onConfirm = jest.fn();
    await render(<SlideToConfirm label="Absagen" onConfirm={onConfirm} disabled />);
    await fireEvent(screen.getByRole('button', { name: 'Absagen' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    await act(() => jest.runAllTimers());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

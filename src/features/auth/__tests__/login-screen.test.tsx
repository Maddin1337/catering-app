import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { LoginScreen } from '../screens/login-screen';

const mockMutate = jest.fn();

jest.mock('../api', () => ({
  useSignIn: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('LoginScreen (SC-01)', () => {
  beforeEach(() => mockMutate.mockClear());

  it('zeigt Überschrift und Online-Hinweis', async () => {
    await render(<LoginScreen />);
    expect(screen.getByRole('header', { name: 'Anmelden' })).toBeTruthy();
    expect(screen.getByText('Anmeldung nur online.')).toBeTruthy();
  });

  it('meldet fehlende Eingaben und ruft die Anmeldung nicht auf', async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Anmelden' }));
    await waitFor(() =>
      expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeTruthy(),
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('meldet mit gültigen Eingaben an', async () => {
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'koch@example.de');
    await fireEvent.changeText(screen.getByLabelText('Passwort'), 'geheim-genug');
    await fireEvent.press(screen.getByRole('button', { name: 'Anmelden' }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({
      email: 'koch@example.de',
      password: 'geheim-genug',
    });
  });
});

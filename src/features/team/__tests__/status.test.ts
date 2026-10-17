import { invitationStatus } from '../status';
import type { Invitation } from '../types';

const base: Invitation = {
  id: '1',
  email: null,
  display_name: 'Test',
  role: 'staff',
  qualification_ids: [],
  expires_at: '2026-11-10T12:00:00Z',
  last_sent_at: null,
  accepted_at: null,
  revoked_at: null,
  created_at: '2026-11-03T12:00:00Z',
};
const now = new Date('2026-11-05T12:00:00Z');

describe('invitationStatus', () => {
  it('ist offen vor Ablauf', () => {
    expect(invitationStatus(base, now)).toBe('open');
  });
  it('ist abgelaufen nach der Frist', () => {
    expect(invitationStatus({ ...base, expires_at: '2026-11-04T12:00:00Z' }, now)).toBe('expired');
  });
  it('ist angenommen, auch wenn die Frist vorbei ist', () => {
    expect(
      invitationStatus(
        { ...base, accepted_at: '2026-11-04T00:00:00Z', expires_at: '2026-11-04T12:00:00Z' },
        now,
      ),
    ).toBe('accepted');
  });
  it('widerrufen geht vor allem anderen', () => {
    expect(
      invitationStatus(
        { ...base, revoked_at: '2026-11-04T00:00:00Z', accepted_at: '2026-11-04T00:00:00Z' },
        now,
      ),
    ).toBe('revoked');
  });
});

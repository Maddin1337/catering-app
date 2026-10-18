import handler from '../../../api/ical';

function res() {
  const r = { code: 0, body: '', headers: {} as Record<string, string> } as {
    code: number;
    body: string;
    headers: Record<string, string>;
    status: (c: number) => typeof r;
    setHeader: (n: string, v: string) => void;
    send: (b: string) => void;
  };
  r.status = (c) => ((r.code = c), r);
  r.setHeader = (n, v) => void (r.headers[n] = v);
  r.send = (b) => void (r.body = b);
  return r;
}

describe('api/ical', () => {
  const token = 'a'.repeat(64);
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'k'.repeat(30);
  });

  it('lehnt ungültige Token ab, ohne die Datenbank zu fragen', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    const r = res();
    await handler({ query: { token: 'zu-kurz' } }, r);
    expect(r.code).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it('liefert den Kalender aus ical_feed', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Firma A',
        entries: [
          {
            uid: 'e1',
            title: 'Gala',
            starts_at: '2026-11-20T17:00:00Z',
            ends_at: '2026-11-20T21:00:00Z',
          },
        ],
      }),
    } as Response);
    const r = res();
    await handler({ query: { token } }, r);
    expect(r.code).toBe(200);
    expect(r.headers['Content-Type']).toContain('text/calendar');
    expect(r.body).toContain('SUMMARY:Gala');
  });

  it('meldet 404, wenn die Datenbank den Token nicht kennt', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => null } as Response);
    const r = res();
    await handler({ query: { token } }, r);
    expect(r.code).toBe(404);
  });
});

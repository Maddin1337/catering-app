// Vercel-Funktion für das Kalender-Abo: /api/ical?token=… → iCalendar-Datei.
// Ruft `ical_feed()` der Datenbank mit dem Token auf (anon, der Token ist das Geheimnis).
import { buildIcal, type IcalEntry } from '../supabase/functions/_shared/domain/ical';

type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

export default async function handler(req: Req, res: Res): Promise<void> {
  const raw = req.query.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (!/^[0-9a-f]{64}$/.test(token) || !url || !key) {
    res.status(404).send('Nicht gefunden');
    return;
  }
  const r = await fetch(`${url}/rest/v1/rpc/ical_feed`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  const data = (await r.json().catch(() => null)) as { name: string; entries: IcalEntry[] } | null;
  if (!r.ok || !data) {
    res.status(404).send('Nicht gefunden');
    return;
  }
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="kalender.ics"');
  res.status(200).send(buildIcal(data.name, data.entries));
}

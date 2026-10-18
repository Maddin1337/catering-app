// Mobile-Prüfung der Web-App im iPhone-Profil (SE, 13, 15 Pro Max) gegen eine simulierte Datenbank.
// Prüft je Seite: waagerechter Überlauf, Tippflächen < 44 px, Eingabefelder < 16 px (iOS vergrößert sonst), Fehler.
// Aufruf: npx expo export --platform web --output-dir /tmp/dist && PW=<Pfad zu playwright> node scripts/smoke/mobile-audit.mjs /tmp/dist /tmp
// Optional: SIZE="iPhone 13" ONLY=/events,/kitchen SHOT=1 (Bildschirmfotos nach <ausgabe>/shots)
const pw = await import(process.env.PW + '/index.mjs');
const { chromium, devices } = pw;
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2],
  S = process.argv[3];
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};
const srv = http
  .createServer((q, r) => {
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    r.setHeader('content-type', mime[path.extname(f)] ?? 'application/octet-stream');
    fs.createReadStream(f).pipe(r);
  })
  .listen(0);
const port = srv.address().port;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const uid = '11111111-1111-1111-1111-111111111111';
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const session = {
  access_token: jwt,
  refresh_token: 'r',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: uid,
    email: 'test@example.com',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};
const fut = (d) => new Date(Date.now() + d * 864e5).toISOString();
const ev = (id, title, status, d, extra = {}) => ({
  id,
  title,
  kind: 'event_catering',
  status,
  starts_at: fut(d),
  ends_at: null,
  event_date: fut(d).slice(0, 10),
  guest_count: 60,
  venue_name: 'Halle 3',
  street: 'Hauptstraße 12',
  postal_code: '10115',
  city: 'Berlin',
  is_pickup: false,
  onsite_contact_name: 'Frau Ansprech',
  onsite_contact_phone: '0170 123',
  meeting_point: 'Hintereingang',
  dress_code: 'schwarz',
  staff_notes: null,
  kitchen_notes: 'Nüsse beachten',
  occasion: null,
  internal_notes: null,
  option_expires_at: null,
  changes_until: null,
  customer_id: 'c1',
  cancellation_agreement: null,
  invoice_reference: null,
  invoiced_on: null,
  created_at: fut(-2),
  customers: { name: 'Müller GmbH' },
  draft_guest_count: 60,
  basis: 'binding',
  has_open_change: false,
  ...extra,
});
const events = [
  ev('e1', 'Firmenfeier mit sehr langem Titel Sommerfest Müller GmbH 2026', 'confirmed', 3),
  ev('e2', 'Hochzeit', 'quoted', 20),
  ev('e3', 'Anfrage', 'inquiry', 30),
];
const pkg = {
  id: 'p1',
  name: 'Fingerfood Business',
  description: '12 Stück',
  archived_at: null,
  dish_count: 2,
  allergens: ['gluten'],
  diets: [],
};
const dish = {
  id: 'd1',
  name: 'Rinderschmorbraten',
  description: null,
  category: 'main',
  portion_label: 'Portion',
  diets: [],
  allergens: ['celery'],
  allergens_reviewed_at: '2026-10-01T10:00:00Z',
  allergens_reviewed_by: null,
  archived_at: null,
};
const header = {
  id: 'q1',
  event_id: 'e1',
  number: 'A-2026-0001',
  status: 'draft',
  revision: 0,
  pricing_mode: 'flat',
  markup_bp: 20000,
  price_display: 'net',
  discount_bp: 0,
  discount_cents: 0,
  deposit_bp: null,
  deposit_cents: null,
  deposit_due_on: null,
  customer_reference: null,
  intro_text: null,
  terms_text: null,
  closing_text: null,
  valid_until: fut(20).slice(0, 10),
  total_net_cents: 139650,
  total_tax_cents: 9776,
  total_gross_cents: 149426,
  cost_total_cents: null,
  cost_incomplete: false,
  has_unsent_changes: false,
};
const item = {
  id: 'i1',
  type: 'package',
  sort_order: 0,
  menu_package_id: 'p1',
  dish_id: null,
  name: 'Fingerfood Business',
  description: null,
  unit_label: 'Person',
  quantity_mode: 'per_guest',
  quantity: 60,
  hours: null,
  unit_price_cents: 2450,
  price_is_manual: false,
  markup_bp: null,
  unit_cost: null,
  discount_bp: 0,
  tax_rate_id: 't7',
  choice_group: null,
  is_selected: true,
  customer_can_edit_quantity: false,
  is_heading: false,
};
const snap = {
  schema_version: 1,
  revision: 1,
  frozen_at: fut(-1),
  company: { name: 'Krügers Küche', accent_color: '#1F6F5C', contact_email: 'k@k.de' },
  customer: { name: 'Müller' },
  event: {
    title: 'Firmenfeier',
    starts_at: fut(3),
    ends_at: null,
    guest_count: 60,
    venue: 'Halle 3',
  },
  quote: {
    number: 'A-2026-0001',
    price_display: 'net',
    valid_until: fut(20).slice(0, 10),
    intro_text: 'Guten Tag, vielen Dank für Ihre Anfrage.',
    terms_text: 'Zahlbar in 14 Tagen.',
    closing_text: null,
    discount_bp: 0,
    discount_cents: 0,
    deposit: { amount_cents: null },
  },
  items: [
    {
      id: 'i1',
      type: 'package',
      name: 'Fingerfood Business',
      description: null,
      quantity: 60,
      quantity_mode: 'per_guest',
      unit_label: 'Person',
      hours: null,
      unit_price_display_cents: 2450,
      discount_bp: 0,
      line_net_cents: 147000,
      line_gross_cents: 157290,
      is_selected: true,
      is_heading: false,
      allergens: ['gluten'],
      diets: [],
      package_dishes: [
        { name: 'Lachsbrötchen', portion_factor: 1, allergens: ['fish', 'gluten'], diets: [] },
      ],
      choice_group: 'menu',
      tax_rate_bp: 700,
    },
    {
      id: 'i2',
      type: 'package',
      name: 'Alternative Mediterran',
      description: null,
      quantity: 60,
      quantity_mode: 'per_guest',
      unit_label: 'Person',
      hours: null,
      unit_price_display_cents: 2600,
      discount_bp: 0,
      line_net_cents: null,
      line_gross_cents: null,
      is_selected: false,
      is_heading: false,
      allergens: [],
      diets: [],
      package_dishes: [],
      choice_group: 'menu',
      tax_rate_bp: 700,
    },
  ],
  totals: {
    sum_before_discount_cents: 147000,
    discount_cents: 0,
    net_cents: 147000,
    tax: [{ rate_bp: 700, base_cents: 147000, tax_cents: 10290 }],
    gross_cents: 157290,
    per_guest_cents: 2621,
  },
};
const portal = {
  state: 'ok',
  company: {
    name: 'Krügers Küche',
    accent_color: '#1F6F5C',
    phone: '030 123456',
    contact_email: 'k@k.de',
    imprint_url: 'https://k.de/i',
    privacy_policy_url: 'https://k.de/d',
  },
  quote: {
    number: 'A-2026-0001',
    revision: 1,
    status: 'sent',
    valid_until: fut(20).slice(0, 10),
    expired: false,
    sent_at: fut(-1),
    send_mode: null,
    accepted_at: null,
    acceptance_revision: null,
    acceptance_name: null,
    declined_at: null,
  },
  event: { status: 'quoted', changes_until: fut(10), changes_locked: false },
  snapshot: snap,
  selection: {},
  dietary: [
    {
      id: 'x1',
      person_count: 2,
      diet: 'vegan',
      avoid_allergens: ['gluten'],
      guest_name: null,
      table_label: null,
      note: 'Zöliakie',
    },
  ],
  has_pending_change: false,
};
const tables = {
  company_profile: {
    id: 'c1',
    name: 'Krügers Küche',
    accent_color: '#0F766E',
    onboarding_completed_at: '2026-10-01T00:00:00Z',
    is_writable: true,
    country: 'DE',
    contact_email: 'a@b.de',
    phone: '030 123',
    logo_path: null,
    shift_cancel_deadline_hours: 48,
    effective_plan: 'profi',
  },
  subscriptions: {
    status: 'trialing',
    trial_ends_at: '2026-11-03T22:59:59Z',
    writable_until: '2026-11-03T22:59:59Z',
  },
  companies: {
    name: 'Krügers Küche',
    logo_path: null,
    phone: null,
    contact_email: 'k@k.de',
    website: null,
    street: null,
    postal_code: null,
    city: null,
    vat_id: null,
    tax_number: null,
    footer_text: null,
    privacy_policy_url: null,
    imprint_url: null,
    accent_color: '#0F766E',
    price_entry_mode: 'net',
    default_pricing_mode: 'flat',
    default_markup_bp: 20000,
    price_rounding_cents: 10,
    quote_validity_days: 21,
    portal_change_lead_hours: 72,
    portal_change_lead_hours_business_lunch: 24,
    shift_cancel_deadline_hours: 48,
    shopping_buffer_bp: 500,
    quote_intro_text: null,
    quote_terms_text: null,
    quote_closing_text: null,
    quote_item_templates: [
      {
        type: 'service',
        name: 'Servicekraft',
        unit_label: 'Person',
        unit_price_cents: 3200,
        quantity_mode: 'fixed',
        hours: 6,
      },
    ],
  },
  tax_rates: [
    {
      id: 't7',
      name: 'Speisen 7 %',
      rate_bp: 700,
      category: 'food',
      reviewed_at: null,
      is_default: true,
    },
    {
      id: 't19',
      name: 'Personal 19 %',
      rate_bp: 1900,
      category: 'service',
      reviewed_at: '2026-10-01T10:00:00Z',
      is_default: false,
    },
  ],
  events,
  kitchen_events: events,
  customers: [
    {
      id: 'c1',
      type: 'business',
      name: 'Müller GmbH',
      contact_person: 'Frau Müller',
      email: 'm@mueller.de',
      phone: '030 99',
      billing_street: 'Weg 1',
      billing_postal_code: '10115',
      billing_city: 'Berlin',
      vat_id: null,
      notes: null,
    },
  ],
  kitchen_dishes: [dish],
  kitchen_menu_packages: [pkg],
  kitchen_ingredients: [
    { id: 'rind', name: 'Rinderschulter', unit: 'g', product_group: 'Fleisch', archived_at: null },
  ],
  dish_ingredients: [
    { dish_id: 'd1', ingredient_id: 'rind', quantity_per_person: '180', sort_order: 0 },
  ],
  menu_package_dishes: [
    { menu_package_id: 'p1', dish_id: 'd1', portion_factor: '1.00', sort_order: 0 },
  ],
  quotes: header,
  quote_items: [item],
  quote_revisions: [
    { revision: 1, sent_at: fut(-1), sent_via: 'link', send_mode: null, snapshot: snap },
  ],
  kitchen_event_lines: [
    {
      event_id: 'e1',
      basis: 'binding',
      item_type: 'package',
      dish_id: null,
      menu_package_id: 'p1',
      quantity: '60',
    },
  ],
  qualifications: [
    { id: 'q1', name: 'Service' },
    { id: 'q2', name: 'Bar' },
  ],
  shift_slots: [
    {
      id: 's1',
      event_id: 'e1',
      qualification_id: 'q1',
      title: 'Service',
      starts_at: fut(3),
      ends_at: fut(3.25),
      seats: 2,
      taken_seats: 1,
      meeting_point: null,
      dress_code: null,
      notes: null,
      published_at: fut(-1),
      cancelled_at: null,
      cancel_reason: null,
    },
  ],
  shift_applications: [
    {
      id: 'a1',
      shift_slot_id: 's1',
      member_id: 'm3',
      status: 'applied',
      comment: 'gern',
      applied_at: fut(-1),
      late_cancellation: false,
      status_note: null,
    },
  ],
  shift_board: [
    {
      shift_slot_id: 's1',
      title: 'Service',
      qualification_name: 'Service',
      starts_at: fut(3),
      ends_at: fut(3.25),
      seats: 2,
      free_seats: 1,
      dress_code: 'schwarz',
      event_kind: 'event_catering',
      guest_count: 60,
      postal_code: '10115',
      city: 'Berlin',
      is_tentative: false,
      my_application_status: null,
    },
  ],
  my_shifts: [
    {
      application_id: 'a1',
      status: 'accepted',
      shift_slot_id: 's1',
      title: 'Service',
      qualification_name: 'Service',
      starts_at: fut(3),
      ends_at: fut(3.25),
      is_called_off: false,
      is_tentative: false,
      cancel_deadline_at: fut(1),
      late_cancellation: false,
      status_note: null,
      postal_code: '10115',
      city: 'Berlin',
      event_title: 'Gala',
      venue_name: 'Halle 3',
      street: 'Hauptstr. 1',
      meeting_point: 'Hintereingang',
      dress_code: 'schwarz',
      onsite_contact_name: 'Frau Ansprech',
      onsite_contact_phone: '0170 1',
      staff_notes: null,
      slot_notes: null,
    },
  ],
  intake_questions: [
    {
      id: 'iq1',
      sort_order: 10,
      question: 'Wer ist der Kunde?',
      answer_type: 'customer',
      options: [],
      is_required: true,
      help_text: null,
      target_field: 'customer',
      show_if: null,
      archived_at: null,
    },
  ],
  event_schedule_items: [
    { id: 'z1', kind: 'setup', label: null, starts_at: fut(3), ends_at: null, notes: null },
  ],
  event_dietary_requirements: [],
  event_status_changes: [],
  invitations: [],
  member_qualifications: [],
  team_directory: [],
  intake_answers: [],
};
function members(role) {
  return {
    id: 'm1',
    company_id: 'c1',
    role,
    display_name: 'Anna Admin',
    phone: null,
    joined_at: '2026-10-01',
    login_email: 'a@x.de',
  };
}
const team = [
  {
    id: 'm1',
    display_name: 'Anna Admin',
    role: 'admin',
    phone: null,
    joined_at: '2026-10-01',
    login_email: 'a@x.de',
  },
  {
    id: 'm3',
    display_name: 'Sven Service',
    role: 'staff',
    phone: '0170',
    joined_at: '2026-10-01',
    login_email: 's@x.de',
  },
];
const urls = {
  admin: [
    '/',
    '/events',
    '/calendar',
    '/more',
    '/events/e1',
    '/events/e2',
    '/events/new',
    '/events/intake',
    '/events/e1/quote',
    '/events/e1/quote-send',
    '/events/e1/edit',
    '/events/e1/copy',
    '/customers',
    '/customers/c1',
    '/customers/new',
    '/customers/import',
    '/dishes',
    '/dishes/new',
    '/dishes/d1',
    '/packages',
    '/packages/p1',
    '/ingredients',
    '/team',
    '/team/invite',
    '/team/m3',
    '/settings',
    '/settings/company',
    '/settings/branding',
    '/settings/tax-rates',
    '/settings/qualifications',
    '/settings/defaults',
    '/settings/quote-texts',
    '/settings/questionnaire',
    '/settings/db-status',
    '/profile',
    '/kitchen',
  ],
  kitchen: ['/today', '/events', '/kitchen', '/more', '/shift-board', '/my-shifts'],
  staff: ['/my-shifts', '/shift-board', '/more', '/profile'],
  portal: ['/portal/gut', '/portal/schlecht'],
  out: ['/login', '/register', '/forgot-password'],
};
const sizes = [
  ['iPhone SE', { width: 375, height: 667, deviceScaleFactor: 2 }],
  ['iPhone 13', devices['iPhone 13'].viewport],
  ['iPhone 15 Pro Max', { width: 430, height: 932, deviceScaleFactor: 3 }],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const sz = process.env.SIZE || null;
const browser = await chromium.launch();
const report = [];
for (const [size, vp] of sizes) {
  if (sz && sz !== size) continue;
  for (const [role, list] of Object.entries(urls)) {
    const ctx = await browser.newContext({
      ...devices['iPhone 13'],
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor || 3,
    });
    if (role !== 'out' && role !== 'portal')
      await ctx.addInitScript(
        ([k, v]) => localStorage.setItem(k, v),
        ['sb-lulaptdkzzmyjvdaxefv-auth-token', JSON.stringify(session)],
      );
    await ctx.route('**/*.supabase.co/**', async (route) => {
      const p = new URL(route.request().url()).pathname;
      const j = (b) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      const name = p.split('/').pop();
      if (p.includes('/rpc/portal_get')) {
        const t = JSON.parse(route.request().postData()).p_token;
        return j(t === 'gut' ? portal : { state: 'invalid' });
      }
      if (p.includes('/rpc/'))
        return j(
          name === 'ensure_quote' ? 'q1' : name === 'get_ical_token' ? 'a'.repeat(64) : null,
        );
      if (name === 'company_members') {
        if (route.request().headers()['accept']?.includes('vnd.pgrst.object'))
          return j(members(role));
        const sel = new URL(route.request().url()).searchParams.get('select') || '';
        return sel.includes('login_email') ? j(team) : j(members(role));
      }
      if (name === 'quotes') return j(header);
      if (!(name in tables)) return j([]);
      const t = tables[name];
      return j(t);
    });
    for (const u of list) {
      if (only && !only.includes(u)) continue;
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource|supabase/.test(m.text()))
          errs.push('CONSOLE ' + m.text().slice(0, 120));
      });
      await page.goto(`http://localhost:${port}${u}`).catch(() => {});
      await page.waitForTimeout(1800);
      const r = await page.evaluate(() => {
        const W = window.innerWidth;
        const out = {
          overflowX: document.documentElement.scrollWidth > W + 1,
          wide: [],
          small: [],
          fontSmall: [],
        };
        const vis = (e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        // Waagerecht wischbare Reihen (Chip-Leisten) dürfen über den Rand laufen.
        const inScroller = (e) => {
          for (let p = e.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'auto' || o === 'scroll') return true;
          }
          return false;
        };
        document.querySelectorAll('*').forEach((e) => {
          const r = e.getBoundingClientRect();
          if (vis(e) && !inScroller(e) && r.right > W + 2 && r.left < W && out.wide.length < 4)
            out.wide.push(
              (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40) +
                ` r=${Math.round(r.right)}`,
            );
        });
        document
          .querySelectorAll(
            '[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],button,a,input,textarea,[tabindex="0"]',
          )
          .forEach((e) => {
            if (!vis(e)) return;
            const r = e.getBoundingClientRect();
            if ((r.width < 44 || r.height < 44) && out.small.length < 8)
              out.small.push(
                ((e.getAttribute('aria-label') || e.textContent || e.placeholder || e.tagName) + '')
                  .trim()
                  .slice(0, 30) + ` ${Math.round(r.width)}x${Math.round(r.height)}`,
              );
          });
        document.querySelectorAll('input,textarea').forEach((e) => {
          if (vis(e) && parseFloat(getComputedStyle(e).fontSize) < 16)
            out.fontSmall.push(e.tagName + ' ' + getComputedStyle(e).fontSize);
        });
        return out;
      });
      if (process.env.TXT)
        console.log(
          role,
          u,
          (await page.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 160),
        );
      const tb = await page.evaluate(() => {
        const t = document.querySelector('[role=tablist]');
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          h: Math.round(r.height),
          bottom: Math.round(r.bottom),
          vh: innerHeight,
          labels: [...t.querySelectorAll('div,span')]
            .filter((e) => e.children.length === 0 && e.textContent)
            .map((e) => {
              const q = e.getBoundingClientRect();
              return e.textContent + ':' + Math.round(q.bottom);
            })
            .slice(0, 4),
        };
      });
      if (tb && process.env.TB) console.log(u, JSON.stringify(tb));
      const bad =
        r.overflowX || r.wide.length || r.small.length || r.fontSmall.length || errs.length;
      if (bad) report.push({ size, role, url: u, ...r, errs });
      if (process.env.SHOT)
        await page.screenshot({
          path: `${S}/shots/v_${size.replace(/ /g, '')}_${u.replace(/\W+/g, '_')}.png`,
          fullPage: false,
        });
      await page.close();
    }
    await ctx.close();
  }
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
srv.close();

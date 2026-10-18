import type { Customer } from './types';

/** Mögliche Duplikate: gleiche E-Mail oder gleicher Name ohne Groß-/Kleinschreibung (US-09.5). */
export function findDuplicate(
  customers: Customer[],
  candidate: { name: string; email: string },
  exceptId?: string,
): Customer | undefined {
  const name = candidate.name.trim().toLowerCase();
  const email = candidate.email.trim().toLowerCase();
  return customers.find(
    (c) =>
      c.id !== exceptId &&
      ((email !== '' && c.email?.toLowerCase() === email) ||
        (name.length >= 2 && c.name.trim().toLowerCase() === name)),
  );
}

/** Suche ab 2 Zeichen in Name, Ansprechpartner, E-Mail und Telefon (SC-35). */
export function searchCustomers(customers: Customer[], query: string): Customer[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return customers;
  const digits = q.replace(/\D/g, '');
  return customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.contact_person ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)),
  );
}

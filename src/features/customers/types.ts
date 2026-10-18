export type CustomerType = 'business' | 'private';

export type Customer = {
  id: string;
  type: CustomerType;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  billing_street: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  vat_id: string | null;
  notes: string | null;
};

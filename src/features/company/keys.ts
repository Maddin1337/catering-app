export const companyKeys = {
  membership: (userId: string | undefined) => ['membership', userId] as const,
  profile: (companyId: string | undefined) => ['company-profile', companyId] as const,
  taxRates: (companyId: string | undefined) => ['tax-rates', companyId] as const,
  subscription: (companyId: string | undefined) => ['subscription', companyId] as const,
};

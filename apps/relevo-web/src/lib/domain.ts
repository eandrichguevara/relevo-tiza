/**
 * Utility for building brand-aware tenant domain URLs.
 *
 * In production:
 *   brand === 'tiza'   → {subdomain}.tiza.cl
 *   brand === 'relevo' → {subdomain}.relevo.cl
 *
 * In development the env overrides control the suffix (defaults to localhost).
 */

/**
 * Returns the domain suffix for a given tenant brand.
 * Falls back to RELEVO_DOMAIN if brand is unknown.
 */
export function getDomainSuffix(brand?: string): string {
  if (brand === 'tiza') {
    // ponytail: NEXT_PUBLIC_TIZA_DOMAIN env var overrides for dev/localhost
    return process.env.NEXT_PUBLIC_TIZA_DOMAIN || '.tiza.cl';
  }
  // Default / relevo
  return process.env.NEXT_PUBLIC_RELEVO_DOMAIN || '.relevo.cl';
}

/**
 * Formats a full display URL like "mi-colegio.relevo.cl" based on tenant brand.
 */
export function formatTenantDomain(tenant: { brand?: string; subdomain?: string }): string {
  if (!tenant?.subdomain) return '';
  return `${tenant.subdomain}${getDomainSuffix(tenant.brand)}`;
}

/**
 * Returns a human-readable domain hint for creation forms.
 * Shows the suffix without a specific subdomain.
 */
export function getDomainHint(brand?: string): string {
  return getDomainSuffix(brand);
}

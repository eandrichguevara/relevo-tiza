import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getDomainSuffix', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retorna .tiza.cl para brand tiza', async () => {
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix('tiza')).toBe('.tiza.cl');
  });

  it('retorna .relevo.cl para brand relevo', async () => {
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix('relevo')).toBe('.relevo.cl');
  });

  it('retorna .relevo.cl para brand undefined', async () => {
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix()).toBe('.relevo.cl');
  });

  it('retorna .relevo.cl para brand null', async () => {
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix(null as any)).toBe('.relevo.cl');
  });

  it('retorna .relevo.cl para brand desconocido', async () => {
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix('unknown')).toBe('.relevo.cl');
  });

  it('usa NEXT_PUBLIC_TIZA_DOMAIN cuando está definido', async () => {
    vi.stubEnv('NEXT_PUBLIC_TIZA_DOMAIN', '.tiza.dev');
    vi.resetModules();
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix('tiza')).toBe('.tiza.dev');
  });

  it('usa NEXT_PUBLIC_RELEVO_DOMAIN cuando está definido', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEVO_DOMAIN', '.relevo.dev');
    vi.resetModules();
    const { getDomainSuffix } = await import('../domain');
    expect(getDomainSuffix('relevo')).toBe('.relevo.dev');
  });
});

describe('formatTenantDomain', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('formatea dominio para tenant con subdominio y brand', async () => {
    const { formatTenantDomain } = await import('../domain');
    const tenant = { brand: 'tiza', subdomain: 'micolegio' };
    expect(formatTenantDomain(tenant)).toBe('micolegio.tiza.cl');
  });

  it('formatea dominio para tenant con brand relevo', async () => {
    const { formatTenantDomain } = await import('../domain');
    const tenant = { brand: 'relevo', subdomain: 'otrocolegio' };
    expect(formatTenantDomain(tenant)).toBe('otrocolegio.relevo.cl');
  });

  it('retorna string vacío cuando tenant no tiene subdominio', async () => {
    const { formatTenantDomain } = await import('../domain');
    expect(formatTenantDomain({ brand: 'tiza' })).toBe('');
  });

  it('retorna string vacío cuando tenant es undefined', async () => {
    const { formatTenantDomain } = await import('../domain');
    expect(formatTenantDomain(undefined as any)).toBe('');
  });

  it('retorna string vacío cuando tenant es null', async () => {
    const { formatTenantDomain } = await import('../domain');
    expect(formatTenantDomain(null as any)).toBe('');
  });

  it('retorna string vacío cuando subdominio es string vacío', async () => {
    const { formatTenantDomain } = await import('../domain');
    expect(formatTenantDomain({ subdomain: '' })).toBe('');
  });
});

describe('getDomainHint', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retorna .tiza.cl para brand tiza', async () => {
    const { getDomainHint } = await import('../domain');
    expect(getDomainHint('tiza')).toBe('.tiza.cl');
  });

  it('retorna .relevo.cl para brand relevo', async () => {
    const { getDomainHint } = await import('../domain');
    expect(getDomainHint('relevo')).toBe('.relevo.cl');
  });

  it('retorna .relevo.cl por defecto', async () => {
    const { getDomainHint } = await import('../domain');
    expect(getDomainHint()).toBe('.relevo.cl');
  });
});

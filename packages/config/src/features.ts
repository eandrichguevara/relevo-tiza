export const features = {
  tiza: {
    scannerGuided: true,
    itemAnalysis: true,
    studentProgress: true,
    chatSupport: true,
    billing: false,
    multiSchool: false,
  },
  relevo: {
    scannerGuided: false,
    bulkUpload: true,
    executiveKPIs: true,
    billing: true,
    multiSchool: true,
    whiteLabel: true,
  },
} as const;

export type Brand = 'tiza' | 'relevo';
export type FeatureFlags = typeof features.tiza | typeof features.relevo;

/** Todas las keys posibles de feature flags (merge de ambas marcas) */
export type AllFeatureKeys = keyof typeof features.tiza | keyof typeof features.relevo;

/** Mapa completo de feature flags con todas las keys posibles */
export type FeatureFlagsMap = { [K in AllFeatureKeys]: boolean };

/** Marca un FeatureFlags como FeatureFlagsMap para acceso completo a propiedades */
export function toFeatureFlagsMap(flags: FeatureFlags): FeatureFlagsMap {
  return flags as FeatureFlagsMap;
}

export function getFeatures(brand: Brand): FeatureFlags {
  return features[brand];
}

export function getFeaturesMap(brand: Brand): FeatureFlagsMap {
  return features[brand] as unknown as FeatureFlagsMap;
}

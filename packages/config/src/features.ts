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

export function getFeatures(brand: Brand): FeatureFlags {
  return features[brand];
}

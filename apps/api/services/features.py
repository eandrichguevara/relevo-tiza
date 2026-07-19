"""Feature flags — brand defaults + tenant overrides."""

FEATURE_DEFAULTS = {
    "tiza": {
        "scannerGuided": True,
        "itemAnalysis": True,
        "studentProgress": True,
        "chatSupport": True,
        "billing": False,
        "multiSchool": False,
    },
    "relevo": {
        "scannerGuided": False,
        "bulkUpload": True,
        "executiveKPIs": True,
        "billing": True,
        "multiSchool": True,
        "whiteLabel": True,
    },
}


def get_features(brand: str, tenant_settings: dict | None = None) -> dict:
    """Resolve effective feature flags: brand defaults + tenant overrides.

    Args:
        brand: Brand name ("tiza" or "relevo").
        tenant_settings: Optional tenant settings dict (from Tenant.settings JSON).
                         If it contains a "features" key, those values override
                         the brand defaults.

    Returns:
        Merged feature flags dict.
    """
    flags = dict(FEATURE_DEFAULTS.get(brand, FEATURE_DEFAULTS["tiza"]))
    if tenant_settings and "features" in tenant_settings:
        flags.update(tenant_settings["features"])
    return flags

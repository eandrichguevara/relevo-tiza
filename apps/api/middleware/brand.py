"""Brand resolution middleware."""
from typing import Optional
from fastapi import Header, HTTPException

VALID_BRANDS = {"tiza", "relevo"}


async def get_brand(x_tenant_brand: Optional[str] = Header(None, alias="X-Tenant-Brand")) -> str:
    brand = (x_tenant_brand or "tiza").lower()
    if brand not in VALID_BRANDS:
        raise HTTPException(status_code=400, detail=f"Invalid brand: {brand}. Must be tiza or relevo.")
    return brand

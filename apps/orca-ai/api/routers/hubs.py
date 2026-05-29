from fastapi import APIRouter, Request
from api.schemas.common import ok

router = APIRouter(prefix="/hubs", tags=["hubs"])

HUB_DATA = [
    { "id": "hub_cakung", "name": "Hub Cakung (East Jakarta)", "lat": -6.1824, "lng": 106.9213 },
    { "id": "hub_kebon_jeruk", "name": "Hub Kebon Jeruk (West Jakarta)", "lat": -6.1950, "lng": 106.7645 },
    { "id": "hub_pasar_minggu", "name": "Hub Pasar Minggu (South Jakarta)", "lat": -6.2844, "lng": 106.8441 },
    { "id": "hub_kelapa_gading", "name": "Hub Kelapa Gading (North Jakarta)", "lat": -6.1581, "lng": 106.9080 },
    { "id": "hub_cikarang", "name": "Hub Cikarang (Bekasi Regency)", "lat": -6.2715, "lng": 107.1565 },
    { "id": "hub_tangerang", "name": "Hub Tangerang (Airport Cargo)", "lat": -6.1256, "lng": 106.6559 },
    { "id": "hub_bekasi", "name": "Hub Bekasi (MM2100)", "lat": -6.2424, "lng": 107.1138 },
    { "id": "hub_bogor", "name": "Hub Bogor (Sentul)", "lat": -6.5345, "lng": 106.8612 },
    { "id": "hub_depok", "name": "Hub Depok (Cimanggis)", "lat": -6.3725, "lng": 106.8742 },
]

@router.get("/")
async def list_hubs(request: Request):
    # In a real app, this might come from a DB table 'hubs'.
    # For now, we centralize it here to avoid duplication in frontend.
    return ok({"hubs": HUB_DATA})

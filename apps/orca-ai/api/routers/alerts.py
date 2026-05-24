from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from api.schemas.common import ok
from core.config import get_settings
from core.security import require_internal_token
from services.fonnte import FonnteClient

router = APIRouter(prefix="/alerts", tags=["alerts"])


class DispatchAlertRequest(BaseModel):
    shipment_id: str
    alert_type: str = "sla_risk"
    sla_risk_score: float = Field(ge=0, le=100)
    intervention: str = "reroute_via_toll"
    recipient_phone: str | None = None


@router.post("/dispatch", dependencies=[Depends(require_internal_token)])
async def dispatch_alert(payload: DispatchAlertRequest, request: Request):
    settings = get_settings()
    pool = request.app.state.db_pool
    if pool is None:
        return ok({"id": None, "sent": False, "deduplicated": False})
    existing = await pool.fetchrow(
        """
        SELECT id FROM alert_logs
        WHERE shipment_id = $1::uuid AND alert_type = $2 AND created_at >= NOW() - INTERVAL '2 hours'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        payload.shipment_id,
        payload.alert_type,
    )
    if existing:
        return ok({"id": str(existing["id"]), "sent": False, "deduplicated": True})
    phone = payload.recipient_phone or settings.alert_recipient_phone
    message = f"ORCA alert: shipment {payload.shipment_id} risk {payload.sla_risk_score:.1f}. Suggested: {payload.intervention}"
    sent = await FonnteClient(settings.fonnte_api_key, settings.fonnte_api_url).send_alert(phone, message)
    row = await pool.fetchrow(
        """
        INSERT INTO alert_logs (shipment_id, alert_type, sla_risk_score, intervention, notified_via)
        VALUES ($1::uuid, $2, $3, $4, $5)
        RETURNING id
        """,
        payload.shipment_id,
        payload.alert_type,
        payload.sla_risk_score,
        payload.intervention,
        ["whatsapp"] if sent else [],
    )
    return ok({"id": str(row["id"]), "sent": sent, "deduplicated": False})


@router.get("/recent")
async def recent_alerts(request: Request):
    pool = request.app.state.db_pool
    if pool is None:
        return ok({"alerts": []})
    rows = await pool.fetch(
        """
        SELECT a.id, a.shipment_id, s.external_id, a.alert_type, a.sla_risk_score, a.intervention, a.created_at
        FROM alert_logs a
        JOIN shipments s ON s.id = a.shipment_id
        ORDER BY a.created_at DESC
        LIMIT 10
        """
    )
    return ok(
        {
            "alerts": [
                {
                    "id": str(row["id"]),
                    "shipment_id": str(row["shipment_id"]),
                    "external_id": row["external_id"],
                    "alert_type": row["alert_type"],
                    "sla_risk_score": float(row["sla_risk_score"] or 0),
                    "intervention": row["intervention"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        }
    )

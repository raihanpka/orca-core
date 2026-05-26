from fastapi.testclient import TestClient

from core.config import get_settings
from main import app

app.state.db_pool = None
app.state.redis = None
app.state.delay_model = None
app.state.label_encoder = None
app.state.model_version = "test"


def test_health():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "Orca API is running"


def test_public_endpoint_requires_token():
    client = TestClient(app)
    response = client.get("/shipments/active")
    assert response.status_code == 401


def test_public_endpoint_accepts_configured_token():
    client = TestClient(app)
    response = client.get("/shipments/active", headers={"X-API-Token": get_settings().public_api_token})
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_internal_predict_requires_internal_token():
    client = TestClient(app)
    response = client.post("/internal/predict", json={})
    assert response.status_code == 401


def test_alert_dispatch_requires_internal_token():
    client = TestClient(app)
    response = client.post(
        "/alerts/dispatch",
        json={"shipment_id": "00000000-0000-0000-0000-000000000000", "sla_risk_score": 80},
    )
    assert response.status_code == 401

import logging

import httpx

logger = logging.getLogger(__name__)


class FonnteClient:
    def __init__(self, api_key: str, api_url: str):
        self.api_key = api_key
        self.api_url = api_url

    async def send_alert(self, phone: str, message: str) -> bool:
        if not self.api_key or not phone:
            logger.warning("Fonnte credentials or recipient missing; alert stored without send")
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    self.api_url,
                    headers={"Authorization": self.api_key},
                    data={"target": phone, "message": message},
                )
            return response.status_code < 400
        except Exception as exc:
            logger.warning("Fonnte send failed: %s", exc)
            return False

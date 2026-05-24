from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_port: int = 8000
    debug: bool = True

    database_url: str = "postgresql://orca:orca_pass@postgres:5432/orca_db"
    redis_url: str = "redis://redis:6379"
    prediction_cache_ttl_seconds: int = 900
    internal_api_token: str = "dev-internal-token"
    public_api_token: str = "dev-public-token"
    public_rate_limit_per_minute: int = 120

    mlflow_tracking_uri: str = "http://mlflow:5001"
    mlflow_model_name: str = "delay-predictor"
    mlflow_model_stage: str = "Production"

    here_maps_api_key: str = ""
    bmkg_api_base_url: str = "https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast"
    fonnte_api_key: str = ""
    fonnte_api_url: str = "https://api.fonnte.com/send"
    alert_recipient_phone: str = ""

    alert_risk_threshold: float = 70.0
    demo_mode: bool = False
    nsga2_population_size: int = Field(default=100, ge=10)
    nsga2_generations: int = Field(default=200, ge=10)

    kaggle_username: str = ""
    kaggle_key: str = ""

    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

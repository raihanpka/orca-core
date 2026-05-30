import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_port: int = 8010
    debug: bool = True

    # Docker internal hostnames (used when running inside a container)
    database_url: str = "postgresql://orca:orca_pass@postgres:5444/orca_db"
    redis_url: str = "redis://redis:6381"


    prediction_cache_ttl_seconds: int = 900
    internal_api_token: str = "dev-internal-token"
    public_api_token: str = "dev-public-token"
    public_rate_limit_per_minute: int = 120

    mlflow_tracking_uri: str = ""  # empty = MLflow disabled, use local model files
    mlflow_model_name: str = "delay-predictor"
    mlflow_model_stage: str = "Production"

    open_meteo_api_url: str = "https://api.open-meteo.com/v1/forecast"
    stadia_api_key: str = ""
    tomtom_api_key: str = ""
    fonnte_api_key: str = ""
    fonnte_api_url: str = "https://api.fonnte.com/send"
    alert_recipient_phone: str = ""
    osmnx_graph_path: str = "../../data/processed/osmnx/jabodetabek.graphml"
    osmnx_place_name: str = "West Java, Indonesia"
    osmnx_enable_download: bool = False

    alert_risk_threshold: float = 70.0
    # Amplifier for SLA risk formula. v2 uses CalibratedClassifierCV + slack dampening;
    # keep at 1.0 unless re-tuning on production data. Legacy imbalanced models used 4.0.
    sla_risk_amplifier: float = Field(default=1.0, ge=1.0, le=10.0)
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

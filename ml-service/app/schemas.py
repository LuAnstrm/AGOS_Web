from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RiskClass = Literal["low", "moderate", "high"]


class HistoryPoint(BaseModel):
    t: datetime
    depthCm: float
    rateCmPerMin: float | None = None


class PredictRequest(BaseModel):
    """Filtered (EKF) readings for one node, oldest first, latest last."""

    nodeId: str
    history: list[HistoryPoint] = Field(min_length=1)


class ClassifyResponse(BaseModel):
    riskClass: RiskClass
    confidence: float | None
    modelVersion: str


class ForecastResponse(BaseModel):
    h1Cm: float
    h6Cm: float
    h24Cm: float
    modelVersion: str

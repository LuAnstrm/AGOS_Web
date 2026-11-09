"""Model registry.

On start-up the service looks in MODELS_DIR (default ./models) for trained
artifacts and falls back to transparent baselines when none are present, so
the backend pipeline can be built and tested before training is done. Every
response carries `modelVersion`, so baseline results are never mistaken for
the thesis models.

Artifacts
---------
rf.joblib   dict(model=<fitted sklearn classifier>, features=[names...],
                 version="rf-<tag>")   classes must be "low"/"moderate"/"high"
"""

from __future__ import annotations

import logging
import math
import os
from pathlib import Path
from typing import Protocol

import joblib

from . import features as F
from .schemas import ClassifyResponse, ForecastResponse, HistoryPoint

log = logging.getLogger("agos.ml")

# Depth bands (cm) for the baseline classifier — roughly knee and waist
# height, the usual thresholds for "not passable to light vehicles" and
# "not passable to all vehicles / pedestrians".
MODERATE_FROM_CM = 45.0
HIGH_FROM_CM = 90.0
CLASSES = ("low", "moderate", "high")


class Classifier(Protocol):
    version: str

    def classify(self, history: list[HistoryPoint]) -> ClassifyResponse: ...


class Forecaster(Protocol):
    version: str

    def forecast(self, history: list[HistoryPoint]) -> ForecastResponse: ...


class BaselineClassifier:
    """Current depth band only. The trend is deliberately left out: the
    backend's alert policy combines this class with the forecast, so adding
    the trend here too would count a rise twice."""

    version = "baseline-bands-v1"

    def classify(self, history: list[HistoryPoint]) -> ClassifyResponse:
        idx = _band(history[-1].depthCm)
        return ClassifyResponse(riskClass=CLASSES[idx], confidence=None, modelVersion=self.version)


def _band(depth: float) -> int:
    return 2 if depth >= HIGH_FROM_CM else 1 if depth >= MODERATE_FROM_CM else 0


class SklearnClassifier:
    def __init__(self, artifact: dict):
        self.model = artifact["model"]
        self.features: list[str] = list(artifact["features"])
        self.version: str = artifact.get("version", "rf-unversioned")
        unknown = set(map(str, self.model.classes_)) - set(CLASSES)
        if unknown:
            raise ValueError(f"rf.joblib has unexpected classes {unknown}")

    def classify(self, history: list[HistoryPoint]) -> ClassifyResponse:
        x = F.vector(F.extract(history), self.features)
        proba = self.model.predict_proba(x)[0]
        i = int(proba.argmax())
        return ClassifyResponse(
            riskClass=str(self.model.classes_[i]),
            confidence=round(float(proba[i]), 4),
            modelVersion=self.version,
        )


class BaselineForecaster:
    """Damped trend: the 30-minute trend decays with time constant TAU_MIN,
    so a short-term rise isn't extrapolated linearly for 24 hours. The rate
    is capped at MAX_RATE so a surge can't project absurd depths."""

    version = "baseline-damped-trend-v1"
    TAU_MIN = 90.0
    MAX_RATE = 3.0  # cm/min

    def _at(self, depth: float, rate: float, minutes: float) -> float:
        return max(0.0, depth + rate * self.TAU_MIN * (1 - math.exp(-minutes / self.TAU_MIN)))

    def forecast(self, history: list[HistoryPoint]) -> ForecastResponse:
        last = history[-1]
        rate = max(-self.MAX_RATE, min(self.MAX_RATE, F.trend_rate(history)))
        return ForecastResponse(
            h1Cm=round(self._at(last.depthCm, rate, 60), 2),
            h6Cm=round(self._at(last.depthCm, rate, 360), 2),
            h24Cm=round(self._at(last.depthCm, rate, 1440), 2),
            modelVersion=self.version,
        )


def load(models_dir: str | os.PathLike | None = None) -> tuple[Classifier, Forecaster]:
    d = Path(models_dir or os.environ.get("MODELS_DIR", "models"))
    classifier: Classifier = BaselineClassifier()
    forecaster: Forecaster = BaselineForecaster()

    rf = d / "rf.joblib"
    if rf.exists():
        classifier = SklearnClassifier(joblib.load(rf))
        log.info("loaded classifier %s from %s", classifier.version, rf)
    else:
        log.warning("no %s — using %s", rf, classifier.version)

    # LSTM loader is added together with its training script, once the
    # training data's shape is settled.
    log.warning("no LSTM artifact loader yet — using %s", forecaster.version)
    return classifier, forecaster

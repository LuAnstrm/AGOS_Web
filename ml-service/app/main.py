"""AGOS inference service.

    uv run uvicorn app.main:app --port 8000

Called by the NestJS ML module over internal HTTP. Kept separate from the
backend so models can be retrained and redeployed without a backend deploy.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import models
from .schemas import ClassifyResponse, ForecastResponse, PredictRequest

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.classifier, app.state.forecaster = models.load()
    yield


app = FastAPI(title="AGOS ML", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "classifier": app.state.classifier.version,
        "forecaster": app.state.forecaster.version,
    }


# Plain `def` endpoints: FastAPI runs them in a thread pool, so CPU-bound
# inference doesn't block the event loop and the two calls run in parallel.
@app.post("/classify", response_model=ClassifyResponse)
def classify(req: PredictRequest) -> ClassifyResponse:
    return app.state.classifier.classify(req.history)


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: PredictRequest) -> ForecastResponse:
    return app.state.forecaster.forecast(req.history)

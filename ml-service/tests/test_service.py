from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sklearn.ensemble import RandomForestClassifier

from app import features as F
from app import models
from app.main import app
from app.schemas import HistoryPoint

T0 = datetime(2026, 11, 9, tzinfo=timezone.utc)


def series(depths, rate=0.0):
    return [
        {"t": (T0 + timedelta(minutes=i)).isoformat(), "depthCm": d, "rateCmPerMin": rate}
        for i, d in enumerate(depths)
    ]


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))  # empty → baselines
    with TestClient(app) as c:
        yield c


def test_health_reports_baselines(client):
    body = client.get("/health").json()
    assert body["classifier"] == "baseline-bands-v0"
    assert body["forecaster"] == "baseline-damped-trend-v1"


@pytest.mark.parametrize(
    "depth,rate,expected",
    [(20, 0, "low"), (60, 0, "moderate"), (120, 0, "high"), (40, 1.0, "moderate"), (80, 0.3, "moderate")],
)
def test_baseline_classify(client, depth, rate, expected):
    r = client.post("/classify", json={"nodeId": "N", "history": series([depth], rate)})
    assert r.status_code == 200
    assert r.json()["riskClass"] == expected
    assert r.json()["confidence"] is None


def test_baseline_forecast_is_damped_and_ordered(client):
    r = client.post("/forecast", json={"nodeId": "N", "history": series([50], rate=1.0)}).json()
    assert 50 < r["h1Cm"] < 110
    assert r["h1Cm"] < r["h6Cm"] <= r["h24Cm"]
    assert r["h24Cm"] < 50 + 1.0 * 90 + 1  # bounded by rate * tau


def test_forecast_uses_trend_not_ekf_spike(client):
    # Flat 30 min, but the filter's last rate spiked to 70 cm/min.
    hist = series([100.0] * 30, rate=0.0)
    hist[-1]["rateCmPerMin"] = 70.0
    r = client.post("/forecast", json={"nodeId": "N", "history": hist}).json()
    assert abs(r["h1Cm"] - 100) < 1
    assert r["h24Cm"] < 101


def test_forecast_rate_is_capped(client):
    hist = series([float(10 * i) for i in range(30)])  # 10 cm/min surge
    r = client.post("/forecast", json={"nodeId": "N", "history": hist}).json()
    assert r["h24Cm"] <= 290 + 3.0 * 90 + 1


def test_forecast_never_negative(client):
    r = client.post("/forecast", json={"nodeId": "N", "history": series([5], rate=-2.0)}).json()
    assert min(r["h1Cm"], r["h6Cm"], r["h24Cm"]) >= 0


def test_rejects_empty_history(client):
    assert client.post("/classify", json={"nodeId": "N", "history": []}).status_code == 422


def test_features_window_deltas():
    hist = [HistoryPoint(**p) for p in series(list(range(0, 120)))]
    f = F.extract(hist)
    assert f["delta_15m_cm"] == 15
    assert f["delta_60m_cm"] == 60
    assert f["max_3h_cm"] == 119


def test_trained_rf_artifact_is_loaded_and_used(tmp_path):
    names = ["depth_cm", "rate_cm_per_min"]
    X = np.array([[10, 0], [20, 0], [60, 0], [70, 0], [110, 0], [150, 0]])
    y = np.array(["low", "low", "moderate", "moderate", "high", "high"])
    rf = RandomForestClassifier(n_estimators=20, random_state=0).fit(X, y)
    joblib.dump({"model": rf, "features": names, "version": "rf-test"}, tmp_path / "rf.joblib")

    clf, _ = models.load(tmp_path)
    out = clf.classify([HistoryPoint(**p) for p in series([130])])
    assert out.modelVersion == "rf-test"
    assert out.riskClass == "high"
    assert 0 < out.confidence <= 1

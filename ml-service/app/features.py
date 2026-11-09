"""Features derived from a node's filtered depth history.

These are the inputs a trained Random Forest is expected to use. A model
artifact records the feature names it was trained on; `vector()` builds the
row in that order, so adding a feature here never breaks an older model.
"""

from datetime import timedelta

import numpy as np

from .schemas import HistoryPoint


def _depth_at_or_before(history: list[HistoryPoint], minutes_ago: float) -> float:
    cutoff = history[-1].t - timedelta(minutes=minutes_ago)
    for p in reversed(history):
        if p.t <= cutoff:
            return p.depthCm
    return history[0].depthCm


def trend_rate(
    history: list[HistoryPoint],
    window_min: float = 30.0,
    min_span_min: float = 10.0,
) -> float:
    """Least-squares slope (cm/min) over the last `window_min` minutes.

    Steadier than the filter's instantaneous rate, which can spike to tens of
    cm/min while it snaps onto a flash-flood surge, and is noisy for a node's
    first few readings. Returns 0 (no known trend) until the window holds at
    least 3 points spanning `min_span_min`, so a freshly started node can't
    raise a "rising" alert off its first readings.
    """
    last = history[-1]
    cutoff = last.t - timedelta(minutes=window_min)
    pts = [p for p in history if p.t >= cutoff]
    if len(pts) < 3:
        return 0.0
    t = np.array([(p.t - last.t).total_seconds() / 60 for p in pts])
    if np.ptp(t) < min_span_min:
        return 0.0
    d = np.array([p.depthCm for p in pts])
    return float(np.polyfit(t, d, 1)[0])


def extract(history: list[HistoryPoint]) -> dict[str, float]:
    last = history[-1]
    depths = np.array([p.depthCm for p in history])
    return {
        "depth_cm": last.depthCm,
        "rate_cm_per_min": last.rateCmPerMin if last.rateCmPerMin is not None else 0.0,
        "trend_30m_cm_per_min": trend_rate(history),
        "delta_15m_cm": last.depthCm - _depth_at_or_before(history, 15),
        "delta_60m_cm": last.depthCm - _depth_at_or_before(history, 60),
        "max_3h_cm": float(depths.max()),
        "mean_3h_cm": float(depths.mean()),
    }


def vector(features: dict[str, float], names: list[str]) -> np.ndarray:
    missing = [n for n in names if n not in features]
    if missing:
        raise ValueError(f"model expects features not produced by extract(): {missing}")
    return np.array([[features[n] for n in names]], dtype=float)

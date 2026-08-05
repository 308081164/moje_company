"""
Inlay-aware Hunyuan3D generation strategy resolution (轨道 A).
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional


class InlayGenStrategy(str, Enum):
    """How inlay mesh participates during 3D inference (not post-process)."""

    MV_ONLY = "mv_only"
    MV_THEN_OMNI_REFINE = "mv_then_omni_refine"
    OMNI_SINGLE = "omni_single"


def resolve_inlay_gen_strategy(
    params: Dict[str, Any],
    *,
    use_multi_view: bool,
    has_inlay: bool,
    omni_enabled: bool,
) -> InlayGenStrategy:
    raw = (params.get("inlay_gen_strategy") or "").strip().lower()
    if raw:
        try:
            return InlayGenStrategy(raw)
        except ValueError:
            pass

    if not has_inlay:
        return InlayGenStrategy.MV_ONLY

    if use_multi_view:
        if omni_enabled:
            return InlayGenStrategy.MV_THEN_OMNI_REFINE
        return InlayGenStrategy.MV_ONLY

    if omni_enabled:
        return InlayGenStrategy.OMNI_SINGLE
    return InlayGenStrategy.MV_ONLY


def strategy_uses_omni_during_inference(strategy: InlayGenStrategy) -> bool:
    return strategy in (
        InlayGenStrategy.OMNI_SINGLE,
        InlayGenStrategy.MV_THEN_OMNI_REFINE,
    )


def strategy_forces_single_view(strategy: InlayGenStrategy) -> bool:
    return strategy == InlayGenStrategy.OMNI_SINGLE


def strategy_runs_post_mv_omni(strategy: InlayGenStrategy) -> bool:
    return strategy == InlayGenStrategy.MV_THEN_OMNI_REFINE

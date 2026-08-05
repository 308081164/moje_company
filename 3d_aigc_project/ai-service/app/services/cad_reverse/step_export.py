"""STEP export via OCCT."""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def export_step(shape, output_path: str, schema: str = "AP214") -> bool:
    try:
        from OCC.Core.IFSelect import IFSelect_RetDone
        from OCC.Core.STEPControl import STEPControl_AsIs, STEPControl_Writer
        from OCC.Core.Interface import Interface_Static

        if schema.upper() == "AP242":
            Interface_Static.SetCVal("write.step.schema", "AP242DIS")
        else:
            Interface_Static.SetCVal("write.step.schema", "AP203")

        writer = STEPControl_Writer()
        writer.Transfer(shape, STEPControl_AsIs)
        status = writer.Write(output_path)
        if status != IFSelect_RetDone:
            logger.warning("STEP write status: %s", status)
            return False
        return True
    except ImportError:
        logger.error("pythonocc-core not installed; cannot export STEP")
        return False
    except Exception as e:
        logger.error("STEP export failed: %s", e)
        return False

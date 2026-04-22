from pydantic import BaseModel
from typing import List, Optional

class ReceivingItemDivergence(BaseModel):
    product_code: str
    description: str
    expected_qty: float
    counted_qty: float
    divergence: float
    status: str # FALTA, SOBRA, CONFORME

class ReceivingDivergenceReport(BaseModel):
    session_id: str
    nfe_number: str
    issuer_name: str
    items: List[ReceivingItemDivergence]
    has_divergence: bool

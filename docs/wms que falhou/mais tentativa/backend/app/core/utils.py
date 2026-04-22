from typing import Any
import json

def safe_float(value: Any) -> float:
    try:
        return float(value or 0.0)
    except (ValueError, TypeError):
        return 0.0

def safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (ValueError, TypeError):
        return 0

def normalize_unit(unit: Any) -> str:
    if not unit: return "un"
    u = str(unit).lower().strip()
    mapping = {
        "unidade": "un", "unidades": "un", "pç": "un", "peça": "un",
        "caixa": "cx", "cartão": "cx",
        "quilograma": "kg", "quilo": "kg"
    }
    return mapping.get(u, u)

def json_dumps_safe(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)

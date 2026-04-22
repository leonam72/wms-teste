from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

def find_best_drawer(
    state: Dict[str, Any], 
    depot_id: str,
    product_code: str,
    family: Optional[str],
    incoming_kg: float,
    is_quarantine: bool = False
) -> Optional[str]:
    """
    Motor de Endereçamento (Slotting) do WMS.
    Retorna a drawer_key ideal com base em regras de giro, qualidade e consolidação.
    """
    
    shelves = (state.get("shelvesAll") or {}).get(depot_id) or []
    depot_products = (state.get("productsAll") or {}).setdefault(depot_id, {})
    
    # 1. Filtro Inicial por Tipo de Prateleira (Qualidade/Bloqueio)
    target_type = "quarantine" if is_quarantine else "normal"
    eligible_shelves = [
        s for s in shelves 
        if (s.get("type") or s.get("shelf_type") or "normal").lower() == target_type
    ]
    
    if not eligible_shelves:
        return None

    # 2. Regra de Consolidação: Tenta achar gaveta que já tem o mesmo produto
    # Isso reduz a fragmentação do estoque.
    for shelf in eligible_shelves:
        shelf_id = shelf.get("id")
        floors = int(shelf.get("floors", 0))
        drawers_per_floor = int(shelf.get("drawers", 0))
        max_kg = float(shelf.get("maxKg") or 50.0)
        
        for f in range(1, floors + 1):
            for d in range(1, drawers_per_floor + 1):
                drawer_key = f"{shelf_id}.F{f}.G{d}"
                current_items = depot_products.get(drawer_key) or []
                
                # Verifica se o produto já está lá
                has_same = any(it.get("code") == product_code for it in current_items)
                if has_same:
                    current_kg = sum(float(it.get("kgTotal") or 0) for it in current_items)
                    if current_kg + incoming_kg <= max_kg + 0.1: # Tolerância de 100g
                        return drawer_key

    # 3. Regra de Giro (ABC): Produtos 'ALTO GIRO' preferem andares baixos (F1, F2)
    is_high_turnover = family and "ALTO GIRO" in family.upper()
    
    for shelf in eligible_shelves:
        shelf_id = shelf.get("id")
        floors = int(shelf.get("floors", 0))
        drawers_per_floor = int(shelf.get("drawers", 0))
        max_kg = float(shelf.get("maxKg") or 50.0)
        
        # Se for alto giro, percorremos andares de baixo pra cima (1 -> floors)
        # Se for baixo giro ou normal, podemos seguir a mesma lógica ou preferir andares altos
        for f in range(1, floors + 1):
            if is_high_turnover and f > 2:
                continue # Pula andares altos para produtos de alto giro
                
            for d in range(1, drawers_per_floor + 1):
                drawer_key = f"{shelf_id}.F{f}.G{d}"
                current_items = depot_products.get(drawer_key) or []
                current_kg = sum(float(it.get("kgTotal") or 0) for it in current_items)
                
                if current_kg + incoming_kg <= max_kg + 0.1:
                    return drawer_key

    # 4. Fallback: Se não achou nos andares baixos para alto giro, tenta em qualquer um
    if is_high_turnover:
        return find_best_drawer(state, depot_id, product_code, None, incoming_kg, is_quarantine)

    return None

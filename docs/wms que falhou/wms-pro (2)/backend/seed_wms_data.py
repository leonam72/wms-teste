import asyncio
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select

from backend.app.api.routes_wms import _build_bootstrap_payload, _get_state_snapshot, _get_sync_state
from backend.app.core.database import SessionLocal
from backend.app.models.auth import User
from backend.app.models.floorplan import FloorPlanObject, FloorPlanShelf
from backend.app.models.inventory import Depot, Drawer, Expiry, InventoryMovement, Product, Shelf, StockItem


TODAY = date.today()  # usa data atual para datas de entrada e validade


def product_payload(
    code: str,
    name: str,
    category: str,
    supplier: str,
    brand: str,
    manufacturer: str,
    unit: str,
    qty: int,
    kg_per_unit: float,
    *,
    entry_offset_days: int,
    expiry_offsets: list[int] | None = None,
    lot_suffix: str = "01",
    model: str | None = None,
    notes: str | None = None,
    perishable: bool = False,
    serial_control: str = "none",
    temp_min: float | None = None,
    temp_max: float | None = None,
) -> dict:
    expiry_offsets = expiry_offsets or []
    entry_date = TODAY - timedelta(days=entry_offset_days)
    kg_total = round(qty * kg_per_unit, 3)
    base_num = abs(hash(f"{code}-{name}")) % 10_000_000
    ean = f"{7890000000000 + base_num:013d}"[:13]
    ncm = f"{(base_num % 99_999_999):08d}"
    return {
        "code": code,
        "name": name,
        "sku": f"SKU-{code}",
        "ean": ean,
        "category": category,
        "supplier": supplier,
        "unit": unit,
        "brand": brand,
        "manufacturer": manufacturer,
        "model": model or f"{brand}-{code}",
        "ncm": ncm,
        "anvisa": f"ANV{base_num:07d}" if perishable or category in {"Químicos", "Alimentos"} else "",
        "tempMin": temp_min,
        "tempMax": temp_max,
        "minStock": max(2, qty // 3),
        "maxStock": max(qty + 8, qty * 2),
        "reorderPoint": max(1, qty // 2),
        "lengthCm": 12 + (base_num % 35),
        "widthCm": 8 + (base_num % 20),
        "heightCm": 6 + (base_num % 18),
        "perishable": "yes" if perishable else "no",
        "serialControl": serial_control,
        "expiryControl": "yes" if expiry_offsets else "no",
        "notes": notes or f"{category} | lote inicial {lot_suffix}",
        "qty": qty,
        "kg": kg_total,
        "kgTotal": kg_total,
        "kgPerUnit": kg_per_unit,
        "lot": f"{code}-{entry_date.strftime('%Y%m')}-{lot_suffix}",
        "entry": entry_date.isoformat(),
        "expiries": [(TODAY + timedelta(days=offset)).isoformat() for offset in expiry_offsets],
    }


def drawer_key(shelf_code: str, floor: int, drawer_number: int) -> str:
    return f"{shelf_code}{floor}.G{drawer_number}"


def build_dataset() -> list[dict]:
    depots: list[dict] = []

    dep1_shelves = [
        {"code": "A", "floors": 4, "drawers": 4, "maxKg": 60},
        {"code": "B", "floors": 4, "drawers": 4, "maxKg": 55},
        {"code": "C", "floors": 4, "drawers": 4, "maxKg": 50},
    ]
    dep1_stock: dict[str, list[dict]] = {}
    dep1_catalog = [
        ("PK001", "Kit Embalagem E-commerce", "Expedição", "PackLine", "PackFast", "PackFast Brasil", "kit", 8, 1.4, 8, [7]),
        ("PK002", "Filme Stretch 500mm", "Expedição", "PackLine", "StretchPro", "StretchPro SA", "rl", 6, 2.1, 9, []),
        ("PK003", "Etiqueta Térmica 100x150", "Expedição", "LabelCorp", "LabelMax", "LabelMax SA", "rl", 10, 0.7, 5, [14]),
        ("PK004", "Caixa Papelão P40", "Expedição", "BoxBrasil", "CardBox", "CardBox Indústria", "cx", 14, 0.6, 6, []),
        ("PK005", "Envelope Segurança", "Expedição", "SafePack", "SafeMail", "SafeMail Ltda", "pct", 20, 0.08, 7, []),
        ("PK006", "Lacre Numerado", "Expedição", "SealTech", "SealPro", "SealPro SA", "pct", 40, 0.01, 4, []),
        ("PK007", "Ribbon Cera 110x74", "Expedição", "LabelCorp", "ThermoInk", "ThermoInk SA", "rl", 8, 0.28, 3, [5]),
        ("PK008", "Cantoneira Proteção", "Expedição", "PackLine", "PackFast", "PackFast Brasil", "un", 18, 0.12, 10, []),
    ]
    dep1_positions = [
        ("A", 1, 1), ("A", 1, 2), ("A", 1, 3), ("A", 1, 4),
        ("A", 2, 1), ("A", 2, 2), ("A", 2, 3), ("A", 2, 4),
        ("B", 1, 1), ("B", 1, 2), ("B", 2, 1), ("B", 2, 2),
    ]
    for idx, pos in enumerate(dep1_positions):
        drawer = drawer_key(pos[0], pos[1], pos[2])
        item = dep1_catalog[idx % len(dep1_catalog)]
        dep1_stock[drawer] = [
            product_payload(*item[:9], entry_offset_days=item[9], expiry_offsets=item[10], lot_suffix=f"{idx+1:02d}")
        ]
        if idx % 3 == 0:
            extra = dep1_catalog[(idx + 3) % len(dep1_catalog)]
            dep1_stock[drawer].append(
                product_payload(*extra[:9], entry_offset_days=extra[9], expiry_offsets=extra[10], lot_suffix=f"{idx+20:02d}")
            )
    depots.append({
        "id": "dep1",
        "name": "Depósito Principal",
        "address": "Rua Alfa, 100",
        "city": "Curitiba/PR",
        "manager": "Leonardo Ramos",
        "phone": "(41) 3333-1000",
        "notes": "Operação principal com ocupação média.",
        "shelves": dep1_shelves,
        "stock": dep1_stock,
    })

    dep2_shelves = [
        {"code": "F", "floors": 3, "drawers": 4, "maxKg": 35},
        {"code": "G", "floors": 3, "drawers": 4, "maxKg": 40},
    ]
    dep2_stock = {
        "F1.G1": [product_payload("AL001", "Filé de Frango IQF 2kg", "Alimentos", "FrioLog", "ColdFresh", "ColdFresh SA", "cx", 10, 2.0, entry_offset_days=3, expiry_offsets=[4], lot_suffix="01", perishable=True, serial_control="lot", temp_min=-18, temp_max=-10)],
        "F1.G2": [product_payload("AL002", "Hambúrguer Bovino 1kg", "Alimentos", "FrioLog", "ColdFresh", "ColdFresh SA", "cx", 12, 1.0, entry_offset_days=5, expiry_offsets=[8], lot_suffix="01", perishable=True, serial_control="lot", temp_min=-18, temp_max=-10)],
        "F2.G1": [product_payload("AL003", "Queijo Muçarela Fatiado", "Alimentos", "LactoSul", "DairyBox", "DairyBox SA", "pct", 18, 0.4, entry_offset_days=2, expiry_offsets=[2], lot_suffix="01", perishable=True, serial_control="lot", temp_min=1, temp_max=5)],
        "G1.G1": [product_payload("AL004", "Iogurte Natural Integral", "Alimentos", "LactoSul", "DairyBox", "DairyBox SA", "pct", 20, 0.17, entry_offset_days=1, expiry_offsets=[1], lot_suffix="01", perishable=True, serial_control="lot", temp_min=1, temp_max=4)],
        "G1.G2": [product_payload("AL005", "Molho Pesto 500g", "Alimentos", "Sabor Verde", "ChefLine", "ChefLine Indústria", "pct", 14, 0.5, entry_offset_days=4, expiry_offsets=[12], lot_suffix="01", perishable=True, serial_control="lot", temp_min=1, temp_max=8)],
        "G2.G3": [product_payload("AL006", "Polpa de Tomate 5kg", "Alimentos", "Sabor Verde", "ChefLine", "ChefLine Indústria", "sc", 4, 5.0, entry_offset_days=6, expiry_offsets=[16], lot_suffix="01", perishable=True, serial_control="lot", temp_min=1, temp_max=8)],
    }
    depots.append({
        "id": "dep2",
        "name": "Câmara Fria Norte",
        "address": "Av. Polar, 45",
        "city": "Joinville/SC",
        "manager": "Camila Freitas",
        "phone": "(47) 3333-2200",
        "notes": "Perecíveis com foco em validade curta.",
        "shelves": dep2_shelves,
        "stock": dep2_stock,
    })

    dep3_shelves = [
        {"code": "H", "floors": 4, "drawers": 4, "maxKg": 30},
        {"code": "I", "floors": 4, "drawers": 4, "maxKg": 30},
    ]
    dep3_stock = {}
    full_catalog = [
        ("QP001", "Desengraxante Industrial 1L", "Químicos", "QuimTech", "ChemGuard", "ChemGuard Brasil", "fr", 12, 1.05, 12, [-5]),
        ("QP002", "Detergente Alcalino 5L", "Químicos", "QuimTech", "ChemGuard", "ChemGuard Brasil", "gl", 4, 5.2, 20, [20]),
        ("QP003", "Limpador Contato Elétrico", "Químicos", "ElectroClean", "VoltPro", "VoltPro SA", "fr", 10, 0.32, 8, [10]),
        ("QP004", "Spray Dielétrico", "Químicos", "ElectroClean", "VoltPro", "VoltPro SA", "fr", 8, 0.28, 14, [-2]),
        ("QP005", "Absorvente Granulado", "Químicos", "QuimTech", "ChemGuard", "ChemGuard Brasil", "sc", 5, 3.5, 6, [25]),
        ("QP006", "Manta Absorvente", "Químicos", "QuimTech", "ChemGuard", "ChemGuard Brasil", "pct", 12, 0.45, 4, [6]),
    ]
    positions = [(s["code"], floor, drawer) for s in dep3_shelves for floor in range(1, s["floors"] + 1) for drawer in range(1, s["drawers"] + 1)]
    for idx, pos in enumerate(positions):
        drawer = drawer_key(pos[0], pos[1], pos[2])
        item = full_catalog[idx % len(full_catalog)]
        dep3_stock[drawer] = [product_payload(*item[:9], entry_offset_days=item[9], expiry_offsets=item[10], lot_suffix=f"{idx+1:02d}", perishable=True, serial_control="lot", temp_min=5, temp_max=25)]
        if idx % 2 == 0:
            extra = full_catalog[(idx + 2) % len(full_catalog)]
            dep3_stock[drawer].append(product_payload(*extra[:9], entry_offset_days=extra[9], expiry_offsets=extra[10], lot_suffix=f"{idx+31:02d}", perishable=True, serial_control="lot", temp_min=5, temp_max=25))
    depots.append({
        "id": "dep3",
        "name": "Químicos Controlados",
        "address": "Distrito Industrial, 500",
        "city": "Araucária/PR",
        "manager": "Patrícia Nunes",
        "phone": "(41) 3333-4400",
        "notes": "Depósito totalmente ocupado para teste de capacidade e risco.",
        "shelves": dep3_shelves,
        "stock": dep3_stock,
    })

    dep4_shelves = [
        {"code": "J", "floors": 4, "drawers": 4, "maxKg": 45},
        {"code": "K", "floors": 4, "drawers": 4, "maxKg": 55},
        {"code": "L", "floors": 3, "drawers": 4, "maxKg": 70},
    ]
    dep4_stock = {
        "J1.G1": [product_payload("PT001", "Rolamento 6204 ZZ", "Peças Técnicas", "MecParts", "MechCore", "MechCore SA", "pc", 24, 0.18, entry_offset_days=10, expiry_offsets=[], lot_suffix="01", serial_control="serial")],
        "J1.G2": [product_payload("PT002", "Rolamento 6205 ZZ", "Peças Técnicas", "MecParts", "MechCore", "MechCore SA", "pc", 18, 0.22, entry_offset_days=12, expiry_offsets=[], lot_suffix="01", serial_control="serial")],
        "J2.G1": [product_payload("PT003", "Sensor Indutivo M12", "Elétrica", "VoltMax", "VoltPro", "VoltPro SA", "pc", 16, 0.12, entry_offset_days=7, expiry_offsets=[], lot_suffix="01", serial_control="serial")],
        "J2.G2": [product_payload("PT004", "Sensor Fotoelétrico", "Elétrica", "VoltMax", "VoltPro", "VoltPro SA", "pc", 12, 0.18, entry_offset_days=7, expiry_offsets=[], lot_suffix="01", serial_control="serial")],
        "K1.G1": [product_payload("PT005", "Engrenagem Helicoidal 32D", "Peças Técnicas", "GearWorks", "TorqueX", "TorqueX SA", "pc", 6, 4.6, entry_offset_days=18, expiry_offsets=[], lot_suffix="01", serial_control="serial")],
        "K1.G2": [product_payload("PT006", "Eixo Usinado 420mm", "Peças Técnicas", "GearWorks", "TorqueX", "TorqueX SA", "pc", 5, 6.2, entry_offset_days=18, expiry_offsets=[], lot_suffix="01", serial_control="serial")],
        "K2.G3": [product_payload("PT007", "Kit Vedação Pneumática", "Peças Técnicas", "SealParts", "SealFlex", "SealFlex SA", "kit", 10, 0.65, entry_offset_days=8, expiry_offsets=[9], lot_suffix="01")],
        "L1.G1": [product_payload("PT008", "Lubrificante Sintético 1L", "Químicos", "QuimTech", "ChemGuard", "ChemGuard Brasil", "fr", 9, 0.95, entry_offset_days=6, expiry_offsets=[11], lot_suffix="01", perishable=True, serial_control="lot", temp_min=5, temp_max=25)],
    }
    depots.append({
        "id": "dep4",
        "name": "Peças Técnicas Sul",
        "address": "Rua das Engrenagens, 88",
        "city": "São José dos Pinhais/PR",
        "manager": "Bruno Azevedo",
        "phone": "(41) 3333-5500",
        "notes": "Peças, componentes e manutenção com ocupação média.",
        "shelves": dep4_shelves,
        "stock": dep4_stock,
    })

    dep5_shelves = [
        {"code": "M", "floors": 3, "drawers": 4, "maxKg": 50},
        {"code": "N", "floors": 3, "drawers": 4, "maxKg": 50},
    ]
    depots.append({
        "id": "dep5",
        "name": "Reserva Oeste",
        "address": "Anel Logístico, 900",
        "city": "Ponta Grossa/PR",
        "manager": "Aline Costa",
        "phone": "(42) 3333-6600",
        "notes": "Depósito propositalmente vazio para testes.",
        "shelves": dep5_shelves,
        "stock": {},
    })

    return depots


async def reset_inventory_data(session):
    for model in (Expiry, StockItem, InventoryMovement, Drawer, FloorPlanShelf, FloorPlanObject, Shelf, Product, Depot):
        await session.execute(delete(model))


async def seed():
    dataset = build_dataset()
    async with SessionLocal() as session:
        admin = (await session.execute(select(User).where(User.username == "admin").limit(1))).scalars().first()
        if not admin:
            raise RuntimeError("Usuário admin não encontrado. Rode backend/initial_data.py antes.")

        await reset_inventory_data(session)
        await session.flush()

        products_by_code: dict[str, Product] = {}
        movements: list[InventoryMovement] = []

        for depot_index, depot_data in enumerate(dataset):
            depot = Depot(
                id=depot_data["id"],
                name=depot_data["name"],
                address=depot_data["address"],
                city=depot_data["city"],
                manager=depot_data["manager"],
                phone=depot_data["phone"],
                notes=depot_data["notes"],
            )
            session.add(depot)
            await session.flush()

            shelf_map: dict[str, Shelf] = {}
            drawer_map: dict[str, Drawer] = {}
            x_cursor = 120.0
            for shelf_data in depot_data["shelves"]:
                shelf = Shelf(
                    depot_id=depot.id,
                    code=shelf_data["code"],
                    floors=shelf_data["floors"],
                    drawers_per_floor=shelf_data["drawers"],
                    max_kg_per_drawer=shelf_data["maxKg"],
                )
                session.add(shelf)
                await session.flush()
                shelf_map[shelf.code] = shelf
                session.add(FloorPlanShelf(depot_id=depot.id, shelf_id=shelf.id, x=x_cursor, y=80 + (depot_index * 18), rotation=0.0))
                x_cursor += 180

                for floor in range(1, shelf.floors + 1):
                    for drawer_number in range(1, shelf.drawers_per_floor + 1):
                        key = drawer_key(shelf.code, floor, drawer_number)
                        drawer = Drawer(
                            shelf_id=shelf.id,
                            floor_number=floor,
                            drawer_number=drawer_number,
                            drawer_key=key,
                        )
                        session.add(drawer)
                        await session.flush()
                        drawer_map[key] = drawer

            session.add(FloorPlanObject(
                depot_id=depot.id,
                obj_type="textbox",
                x=40,
                y=24,
                w=220,
                h=42,
                text=depot.name,
                style_class="label",
            ))

            for key, items in depot_data["stock"].items():
                drawer = drawer_map[key]
                for item in items:
                    product = products_by_code.get(item["code"])
                    if not product:
                        product = Product(
                            code=item["code"],
                            name=item["name"],
                            sku=item["sku"],
                            ean=item["ean"],
                            category=item["category"],
                            supplier=item["supplier"],
                            unit=item["unit"],
                            brand=item["brand"],
                            manufacturer=item["manufacturer"],
                            model=item["model"],
                            ncm=item["ncm"],
                            anvisa=item["anvisa"] or None,
                            temp_min=item["tempMin"],
                            temp_max=item["tempMax"],
                            min_stock=item["minStock"],
                            max_stock=item["maxStock"],
                            reorder_point=item["reorderPoint"],
                            length_cm=item["lengthCm"],
                            width_cm=item["widthCm"],
                            height_cm=item["heightCm"],
                            is_perishable=item["perishable"] in {"yes", "frozen"},
                            serial_control=item["serialControl"],
                            expiry_control=item["expiryControl"] != "no",
                            notes=item["notes"],
                        )
                        session.add(product)
                        await session.flush()
                        products_by_code[item["code"]] = product

                    stock_item = StockItem(
                        product_id=product.id,
                        drawer_id=drawer.id,
                        quantity=item["qty"],
                        kg=item["kgTotal"],
                        kg_per_unit=item["kgPerUnit"],
                        lot=item["lot"],
                        entry_date=date.fromisoformat(item["entry"]),
                        notes=item["notes"],
                    )
                    session.add(stock_item)
                    await session.flush()

                    for expiry_value in item["expiries"]:
                        session.add(Expiry(stock_item_id=stock_item.id, date_value=date.fromisoformat(expiry_value)))

                    movements.append(InventoryMovement(
                        action=f"Seed: {item['code']} — {item['name']}",
                        icon="📥",
                        detail=f"{depot.name} · {key} · {item['kgTotal']:.3f}kg · lote {item['lot']}",
                        happened_at=datetime.combine(date.fromisoformat(item["entry"]), datetime.min.time()),
                        user_id=admin.id,
                        username=admin.username,
                        depot_id=depot.id,
                        drawer_key=key,
                        product_code=item["code"],
                        payload_json=str(item),
                    ))

        for movement in movements:
            session.add(movement)

        sync_state = await _get_sync_state(session)
        sync_state.last_pushed_at = datetime.utcnow()
        sync_state.version += 1
        snapshot = await _get_state_snapshot(session)
        snapshot.state_json = {}
        snapshot.source = admin.username
        snapshot.notes = "Preparando snapshot após seed"
        await session.commit()

        payload = await _build_bootstrap_payload(session)
        snapshot = await _get_state_snapshot(session)
        snapshot.revision = payload["revision"]
        snapshot.state_json = payload["state"]
        snapshot.source = admin.username
        snapshot.notes = "Snapshot consolidado após seed"
        await session.commit()

        print("Seed concluído.")
        counts = {
            "depots": len(dataset),
            "shelves": sum(len(d["shelves"]) for d in dataset),
            "drawers": sum(s["floors"] * s["drawers"] for d in dataset for s in d["shelves"]),
            "stock_items": sum(len(items) for d in dataset for items in d["stock"].values()),
        }
        for key, value in counts.items():
            print(f"{key}: {value}")


if __name__ == "__main__":
    asyncio.run(seed())

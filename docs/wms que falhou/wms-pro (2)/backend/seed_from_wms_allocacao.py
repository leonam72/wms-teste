import asyncio
import math
import re
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from random import Random
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from sqlalchemy import delete, select

from backend.app.api.routes_wms import _build_bootstrap_payload, _get_state_snapshot, _get_sync_state
from backend.app.core.database import SessionLocal
from backend.app.models.auth import User
from backend.app.models.floorplan import FloorPlanObject, FloorPlanShelf
from backend.app.models.inventory import Depot, Drawer, Expiry, InventoryMovement, Product, Shelf, StockItem


NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
TODAY = date.today()  # usa data atual para datas de entrada e validade
RNG = Random(20260321)
WORKBOOK_PATH = Path(__file__).resolve().parents[1] / "WMS_Alocacao.xlsx"

DEPOT_PROFILES = {
    "A": {"id": "dep_a", "name": "Armazém Alfa | Picking Têxtil", "city": "Blumenau/SC", "manager": "Camila Teles", "phone": "(47) 3100-1001", "notes": "Picking rápido, corredores curtos e bastante remanejamento.", "drawers_per_floor": 4, "extra_columns": 1, "extra_floors": 0, "heavy_columns": {1}, "special_shelves": {}},
    "B": {"id": "dep_b", "name": "Armazém Beta | Fios e Aviamentos", "city": "Gaspar/SC", "manager": "João Mafezolli", "phone": "(47) 3100-1002", "notes": "Maior giro, bastante fracionado e com muita mistura de lotes.", "drawers_per_floor": 4, "extra_columns": 1, "extra_floors": 1, "heavy_columns": {2, 3}, "special_shelves": {}},
    "C": {"id": "dep_c", "name": "Armazém Gama | Pulmão Comercial", "city": "Pomerode/SC", "manager": "Aline Bartz", "phone": "(47) 3100-1003", "notes": "Pulmão de reabastecimento, ocupação alta e gavetas bem heterogêneas.", "drawers_per_floor": 5, "extra_columns": 2, "extra_floors": 1, "heavy_columns": {1, 4}, "special_shelves": {6: "quarantine"}},
    "D": {"id": "dep_d", "name": "Armazém Delta | Reserva Bagunçada", "city": "Brusque/SC", "manager": "Patrícia Venzke", "phone": "(47) 3100-1004", "notes": "Reserva comercial com ruas mais vazias e produtos esquecidos.", "drawers_per_floor": 6, "extra_columns": 2, "extra_floors": 2, "heavy_columns": {1}, "special_shelves": {5: "blocked"}},
    "E": {"id": "dep_e", "name": "Armazém Épsilon | Estampados e Excesso", "city": "Indaial/SC", "manager": "Bruno Ferri", "phone": "(47) 3100-1005", "notes": "Área mais cheia do site, mas com bolsões vazios por quebra de sequência.", "drawers_per_floor": 4, "extra_columns": 2, "extra_floors": 1, "heavy_columns": {2, 5}, "special_shelves": {7: "quarantine", 8: "blocked"}},
}

BRANDS = ["Textura Sul", "Trama Viva", "Fio Real", "Linha Base", "Malharia Prisma", "ColorSet"]
SUPPLIERS = ["Tecidos Horizonte", "Comercial Aurora", "Distribuidora Vale Têxtil", "Atacado Blumenau", "Central do Aviamento"]
MANUFACTURERS = ["Indústria Têxtil Serra", "Malhas do Vale", "Fábrica Costeira", "Confecção Prisma", "Tear Continental"]


def excel_column_name(index: int) -> str:
    value = index
    letters = []
    while value > 0:
        value, remainder = divmod(value - 1, 26)
        letters.append(chr(65 + remainder))
    return "".join(reversed(letters))


def parse_address(value: str) -> dict | None:
    match = re.match(r"^([A-Z]+)(\d+)\.(\d+)([a-z]?)$", str(value or "").strip(), re.IGNORECASE)
    if not match:
        return None
    bairro = match.group(1).upper()
    column = int(match.group(2))
    level = int(match.group(3))
    suffix = (match.group(4) or "a").lower()
    drawer_number = {"a": 1, "b": 2, "c": 3, "d": 4}.get(suffix, 1)
    return {
        "bairro": bairro,
        "column": column,
        "level": level,
        "suffix": suffix,
        "drawer_number": drawer_number,
    }


def infer_unit(name: str, fallback: str = "") -> str:
    normalized = str(fallback or "").strip().upper()
    if normalized:
        return normalized[:3]
    text = str(name or "").upper()
    if "KG" in text:
        return "KG"
    if "MT" in text or "METRO" in text:
        return "MT"
    if "ROLO" in text or "RL" in text:
        return "RL"
    if "PCT" in text or "PACOTE" in text:
        return "PT"
    if "PAR" in text:
        return "PR"
    return "UN"


def infer_weight_per_unit(unit: str, family: str, name: str) -> float:
    base = {
        "KG": 1.0,
        "MT": 0.18,
        "RL": 0.65,
        "PT": 0.22,
        "PR": 0.08,
        "UN": 0.14,
    }.get(unit, 0.16)
    if "TEC." in name.upper():
        base += 0.12
    if "RENDA" in family.upper():
        base *= 0.6
    if "ELAST" in family.upper():
        base *= 0.8
    return round(base, 3)


def build_catalog_sheet_rows():
    with ZipFile(WORKBOOK_PATH) as archive:
        shared = read_shared_strings(archive)
        return load_sheet(archive, shared, "CADASTRO_PRODUTOS")


def build_allocation_sheet_rows():
    with ZipFile(WORKBOOK_PATH) as archive:
        shared = read_shared_strings(archive)
        return load_sheet(archive, shared, "ALOCAÇÃO WMS")


def read_shared_strings(archive: ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values = []
    for item in root.findall(f"{{{NS}}}si"):
        values.append("".join(node.text or "" for node in item.iterfind(f".//{{{NS}}}t")))
    return values


def load_sheet(archive: ZipFile, shared: list[str], name: str) -> list[dict[str, str]]:
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    for sheet in workbook.find(f"{{{NS}}}sheets"):
        if sheet.attrib["name"] != name:
            continue
        rel_id = sheet.attrib[f"{{{RNS}}}id"]
        root = ET.fromstring(archive.read("xl/" + rel_map[rel_id]))
        rows = []
        for row in root.findall(f".//{{{NS}}}sheetData/{{{NS}}}row"):
            data = {}
            for cell in row.findall(f"{{{NS}}}c"):
                ref = cell.attrib.get("r", "")
                column_match = re.match(r"([A-Z]+)", ref)
                if not column_match:
                    continue
                column = column_match.group(1)
                cell_type = cell.attrib.get("t")
                value_node = cell.find(f"{{{NS}}}v")
                if value_node is None:
                    value = ""
                elif cell_type == "s":
                    value = shared[int(value_node.text)]
                else:
                    value = value_node.text or ""
                data[column] = value
            rows.append(data)
        return rows
    return []


def load_catalog(limit: int = 1000) -> list[dict]:
    rows = build_catalog_sheet_rows()
    headers = {value: key for key, value in rows[0].items()}
    seen = set()
    catalog = []
    for row in rows[1:]:
        name = str(row.get(headers.get("Descrição", "A"), "")).strip().upper()
        family = str(row.get(headers.get("Família (Conjunto)", "B"), "")).strip().upper()
        category = str(row.get(headers.get("Grupo de Produtos", "C"), "")).strip().upper()
        if not name or name in seen:
            continue
        seen.add(name)
        catalog.append({"name": name, "family": family, "category": category})
        if len(catalog) >= limit:
            break
    return catalog


def load_location_templates() -> list[dict]:
    rows = build_allocation_sheet_rows()
    headers = {value: key for key, value in rows[0].items()}
    templates = []
    for row in rows[1:]:
        raw_address = str(row.get(headers.get("ENDEREÇO", "A"), "")).strip()
        parsed = parse_address(raw_address)
        if not parsed:
            continue
        templates.append({
            "address": raw_address,
            "bairro": parsed["bairro"],
            "column": parsed["column"],
            "level": parsed["level"],
            "drawer_number": parsed["drawer_number"],
            "product_name": str(row.get(headers.get("PRODUTO ▼", "E"), "")).strip().upper(),
            "family": str(row.get(headers.get("FAMÍLIA ▼", "F"), "")).strip().upper(),
            "category": str(row.get(headers.get("GRUPO ▼", "G"), "")).strip().upper(),
            "unit": infer_unit("", str(row.get(headers.get("UN. MED. ▼", "H"), "")).strip()),
            "allocated_qty": str(row.get(headers.get("QTD. ALOCADA", "I"), "")).strip(),
            "status": str(row.get(headers.get("STATUS", "J"), "")).strip().upper(),
        })
    return templates


def build_depot_layouts(location_templates: list[dict]) -> dict[str, dict]:
    grouped = defaultdict(list)
    for row in location_templates:
        grouped[row["bairro"]].append(row)

    depot_layouts = {}
    for bairro, profile in DEPOT_PROFILES.items():
        rows = grouped[bairro]
        max_column = max((row["column"] for row in rows), default=4)
        max_level = max((row["level"] for row in rows), default=4)
        shelf_count = max_column + profile["extra_columns"]
        floors = max_level + profile["extra_floors"]
        shelves = []
        column_map = {}
        for column in range(1, shelf_count + 1):
            code = excel_column_name(column)
            column_map[column] = code
            shelves.append({
                "code": code,
                "floors": floors,
                "drawers": profile["drawers_per_floor"],
                "maxKg": 65 if column in profile["heavy_columns"] else 42 + ((column % 3) * 8),
                "type": profile["special_shelves"].get(column, "normal"),
            })
        depot_layouts[bairro] = {
            "profile": profile,
            "rows": rows,
            "shelves": shelves,
            "column_map": column_map,
        }
    return depot_layouts


def choose_depot_for_product(product: dict, counter: dict[str, int]) -> str:
    signal = f"{product['family']}|{product['category']}|{product['name']}"
    preferred = list(DEPOT_PROFILES.keys())[abs(hash(signal)) % len(DEPOT_PROFILES)]
    if counter[preferred] <= min(counter.values() or [0]) + 10:
        return preferred
    return min(counter, key=counter.get)


def build_product_records(catalog: list[dict], location_templates: list[dict]) -> list[dict]:
    template_by_name = {}
    for row in location_templates:
        template_by_name.setdefault(row["product_name"], row)

    products = []
    for index, item in enumerate(catalog, start=1):
        template = template_by_name.get(item["name"], {})
        unit = infer_unit(item["name"], template.get("unit", ""))
        family = item["family"] or template.get("family") or "MATERIAIS DIVERSOS"
        category = item["category"] or template.get("category") or family
        quantity_seed = 1 + (index % 9)
        if unit == "KG":
            quantity = 2 + (index % 14)
        elif unit == "MT":
            quantity = 20 + (index % 180)
        elif unit in {"RL", "RO", "PR"}:
            quantity = 1 + (index % 18)
        elif unit == "PT":
            quantity = 4 + (index % 24)
        else:
            quantity = 3 + (index % 30)
        kg_per_unit = infer_weight_per_unit(unit, family, item["name"])
        entry_offset = 2 + (index % 120)
        products.append({
            "code": f"TXT{index:04d}",
            "name": item["name"],
            "family": family,
            "category": category,
            "unit": unit,
            "supplier": SUPPLIERS[index % len(SUPPLIERS)],
            "brand": BRANDS[index % len(BRANDS)],
            "manufacturer": MANUFACTURERS[index % len(MANUFACTURERS)],
            "quantity": quantity if quantity > 0 else quantity_seed,
            "kg_per_unit": kg_per_unit,
            "kg_total": round(quantity * kg_per_unit, 3),
            "entry": TODAY - timedelta(days=entry_offset),
            "lot": f"L{TODAY.year % 100:02d}{index:04d}",
            "notes": f"Origem planilha WMS_Alocacao.xlsx | endereço-base {template.get('address', 'livre')}",
            "template": template,
        })
    return products


def build_drawer_pools(layouts: dict[str, dict]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    primary = defaultdict(list)
    extras = defaultdict(list)
    for bairro, data in layouts.items():
        for row in data["rows"]:
            shelf_code = data["column_map"][row["column"]]
            key = f"{shelf_code}{row['level']}.G{row['drawer_number']}"
            if key not in primary[bairro]:
                primary[bairro].append(key)
        for shelf in data["shelves"]:
            for floor in range(1, shelf["floors"] + 1):
                for drawer in range(1, shelf["drawers"] + 1):
                    key = f"{shelf['code']}{floor}.G{drawer}"
                    if key not in primary[bairro]:
                        extras[bairro].append(key)
    return primary, extras


def build_drawer_capacities(layouts: dict[str, dict]) -> dict[str, dict[str, float]]:
    capacities = {profile["id"]: {} for profile in DEPOT_PROFILES.values()}
    for bairro, data in layouts.items():
        depot_id = data["profile"]["id"]
        for shelf in data["shelves"]:
            for floor in range(1, shelf["floors"] + 1):
                for drawer in range(1, shelf["drawers"] + 1):
                    capacities[depot_id][f"{shelf['code']}{floor}.G{drawer}"] = float(shelf["maxKg"])
    return capacities


def find_available_drawer(
    depot_id: str,
    pools: list[list[str]],
    current_loads: dict[str, dict[str, float]],
    capacities: dict[str, dict[str, float]],
    required_kg: float,
    start_offset: int = 0,
) -> str | None:
    for pool in pools:
        if not pool:
            continue
        for step in range(len(pool)):
            drawer_key = pool[(start_offset + step) % len(pool)]
            capacity = capacities[depot_id].get(drawer_key, 0.0)
            if current_loads[depot_id].get(drawer_key, 0.0) + required_kg <= capacity:
                return drawer_key
    return None


def assign_products_to_drawers(products: list[dict], layouts: dict[str, dict]) -> dict[str, dict[str, list[dict]]]:
    primary_pools, extra_pools = build_drawer_pools(layouts)
    capacities = build_drawer_capacities(layouts)
    usage_counter = {bairro: 0 for bairro in DEPOT_PROFILES}
    stock = {profile["id"]: defaultdict(list) for profile in DEPOT_PROFILES.values()}
    current_loads = {profile["id"]: defaultdict(float) for profile in DEPOT_PROFILES.values()}

    for idx, product in enumerate(products):
        bairro = choose_depot_for_product(product, usage_counter)
        usage_counter[bairro] += 1
        depot_id = DEPOT_PROFILES[bairro]["id"]
        primary_pool = primary_pools[bairro]
        extra_pool = extra_pools[bairro]
        preferred = [primary_pool, extra_pool] if idx < len(primary_pool) else [extra_pool, primary_pool]
        drawer_key = find_available_drawer(
            depot_id,
            preferred,
            current_loads,
            capacities,
            product["kg_total"],
            start_offset=idx,
        )
        if not drawer_key:
            continue
        stock[depot_id][drawer_key].append(product)
        current_loads[depot_id][drawer_key] += product["kg_total"]

    secondary_candidates = products[::4]
    for idx, product in enumerate(secondary_candidates):
        source_bairro = list(DEPOT_PROFILES.keys())[idx % len(DEPOT_PROFILES)]
        depot_id = DEPOT_PROFILES[source_bairro]["id"]
        cloned = {**product}
        cloned["quantity"] = max(1, math.ceil(product["quantity"] * 0.35))
        cloned["kg_total"] = round(cloned["quantity"] * cloned["kg_per_unit"], 3)
        cloned["lot"] = f"{product['lot']}-B"
        cloned["notes"] = f"{product['notes']} | slot secundário"
        drawer_key = find_available_drawer(
            depot_id,
            [extra_pools[source_bairro], primary_pools[source_bairro]],
            current_loads,
            capacities,
            cloned["kg_total"],
            start_offset=idx * 3,
        )
        if not drawer_key:
            continue
        stock[depot_id][drawer_key].append(cloned)
        current_loads[depot_id][drawer_key] += cloned["kg_total"]

    return stock


async def reset_inventory_data(session) -> None:
    for model in (Expiry, StockItem, InventoryMovement, Drawer, FloorPlanShelf, FloorPlanObject, Shelf, Product, Depot):
        await session.execute(delete(model))


async def seed() -> None:
    catalog = load_catalog(limit=1000)
    templates = load_location_templates()
    layouts = build_depot_layouts(templates)
    product_records = build_product_records(catalog, templates)
    stock_map = assign_products_to_drawers(product_records, layouts)

    async with SessionLocal() as session:
        admin = (await session.execute(select(User).where(User.username == "admin").limit(1))).scalars().first()
        if not admin:
            raise RuntimeError("Usuário admin não encontrado. Rode backend/initial_data.py antes.")

        await reset_inventory_data(session)
        await session.flush()

        products_by_code: dict[str, Product] = {}
        movements: list[InventoryMovement] = []

        for depot_order, bairro in enumerate(DEPOT_PROFILES.keys(), start=1):
            profile = DEPOT_PROFILES[bairro]
            layout = layouts[bairro]
            depot = Depot(
                id=profile["id"],
                name=profile["name"],
                address=f"Rua {profile['name'].split('|')[0].strip()}, {100 + depot_order * 17}",
                city=profile["city"],
                manager=profile["manager"],
                phone=profile["phone"],
                notes=profile["notes"],
            )
            session.add(depot)
            await session.flush()

            drawer_map = {}
            x_cursor = 110.0
            for shelf_index, shelf_data in enumerate(layout["shelves"], start=1):
                shelf = Shelf(
                    depot_id=depot.id,
                    code=shelf_data["code"],
                    shelf_type=shelf_data["type"],
                    floors=shelf_data["floors"],
                    drawers_per_floor=shelf_data["drawers"],
                    max_kg_per_drawer=shelf_data["maxKg"],
                )
                session.add(shelf)
                await session.flush()
                session.add(FloorPlanShelf(depot_id=depot.id, shelf_id=shelf.id, x=x_cursor, y=70 + (depot_order * 25), rotation=0.0))
                x_cursor += 150
                for floor in range(1, shelf.floors + 1):
                    for drawer_number in range(1, shelf.drawers_per_floor + 1):
                        key = f"{shelf.code}{floor}.G{drawer_number}"
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
                x=32,
                y=24,
                w=260,
                h=42,
                text=f"{profile['name']} // base {bairro}",
                style_class="label",
            ))

            for drawer_key, items in stock_map[depot.id].items():
                drawer = drawer_map.get(drawer_key)
                if not drawer:
                    continue
                for item in items:
                    product = products_by_code.get(item["code"])
                    if not product:
                        base_num = 7890000000000 + len(products_by_code) + 1
                        product = Product(
                            code=item["code"],
                            name=item["name"],
                            sku=f"SKU-{item['code']}",
                            ean=str(base_num)[:13],
                            category=item["category"],
                            family=item["family"],
                            supplier=item["supplier"],
                            unit=item["unit"],
                            brand=item["brand"],
                            manufacturer=item["manufacturer"],
                            model=item["category"][:80] if item["category"] else item["family"][:80],
                            ncm=f"{(len(products_by_code) * 137) % 99999999:08d}",
                            min_stock=max(1, item["quantity"] // 4),
                            max_stock=max(item["quantity"] + 10, item["quantity"] * 2),
                            reorder_point=max(1, item["quantity"] // 3),
                            length_cm=18 + ((len(products_by_code) * 3) % 40),
                            width_cm=10 + ((len(products_by_code) * 5) % 20),
                            height_cm=4 + ((len(products_by_code) * 7) % 18),
                            is_perishable=False,
                            serial_control="none",
                            expiry_control=False,
                            notes=item["notes"],
                        )
                        session.add(product)
                        await session.flush()
                        products_by_code[item["code"]] = product

                    stock_item = StockItem(
                        product_id=product.id,
                        drawer_id=drawer.id,
                        quantity=item["quantity"],
                        kg=item["kg_total"],
                        kg_per_unit=item["kg_per_unit"],
                        lot=item["lot"],
                        entry_date=item["entry"],
                        notes=item["notes"],
                    )
                    session.add(stock_item)
                    await session.flush()
                    movements.append(InventoryMovement(
                        action=f"Seed XLSX: {item['code']} — {item['name']}",
                        icon="📥",
                        detail=f"{depot.name} · {drawer_key} · {item['quantity']} {item['unit']} · família {item['family']}",
                        happened_at=datetime.combine(item["entry"], datetime.min.time(), tzinfo=UTC),
                        user_id=admin.id,
                        username=admin.username,
                        depot_id=depot.id,
                        drawer_key=drawer_key,
                        product_code=item["code"],
                        payload_json=str({"family": item["family"], "category": item["category"], "source": item["notes"]}),
                    ))

        for movement in movements:
            session.add(movement)

        sync_state = await _get_sync_state(session)
        sync_state.last_pushed_at = datetime.now(UTC)
        sync_state.version += 1
        snapshot = await _get_state_snapshot(session)
        snapshot.state_json = {}
        snapshot.source = admin.username
        snapshot.notes = "Preparando snapshot após seed XLSX"
        await session.commit()

        payload = await _build_bootstrap_payload(session)
        snapshot = await _get_state_snapshot(session)
        snapshot.revision = payload["revision"]
        snapshot.state_json = payload["state"]
        snapshot.source = admin.username
        snapshot.notes = "Snapshot consolidado após seed XLSX"
        await session.commit()

        stock_entries = sum(len(items) for depot_stock in stock_map.values() for items in depot_stock.values())
        print("Seed concluído a partir de WMS_Alocacao.xlsx")
        print(f"depots: {len(DEPOT_PROFILES)}")
        print(f"products: {len(products_by_code)}")
        print(f"stock_items: {stock_entries}")


if __name__ == "__main__":
    asyncio.run(seed())

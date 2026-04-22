import csv
import io
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.inventory import Product
from ..core.utils import normalize_unit, safe_float

class CSVService:
    @staticmethod
    def export_products(products: List[Product]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["codigo", "nome", "sku", "categoria", "unidade"])
        for p in products:
            writer.writerow([p.code, p.name, p.sku, p.category, p.unit])
        return output.getvalue()

    @staticmethod
    async def import_products(db: AsyncSession, csv_content: str):
        reader = csv.DictReader(io.StringIO(csv_content))
        imported_count = 0
        for row in reader:
            # Lógica de Upsert
            product = Product(
                code=row["codigo"],
                name=row["nome"],
                sku=row.get("sku"),
                category=row.get("categoria"),
                unit=normalize_unit(row.get("unidade"))
            )
            db.add(product)
            imported_count += 1
        await db.commit()
        return imported_count

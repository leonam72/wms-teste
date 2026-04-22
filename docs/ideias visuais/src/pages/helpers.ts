import { Product, Warehouse } from "../types/wms";

export function expiryTone(expiresAt: string, warningDays: number) {
  const diffDays = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "red";
  if (diffDays < warningDays) return "yellow";
  return "green";
}

export function warehouseMetrics(warehouse: Warehouse, palletCount: number) {
  const occupancy = Math.round((palletCount / warehouse.capacityPallets) * 100);
  return { occupancy };
}

export function findProductByQuery(products: Product[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return products;
  return products.filter((product) =>
    [product.sku, product.description, product.category, product.manufacturer, product.supplier].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}

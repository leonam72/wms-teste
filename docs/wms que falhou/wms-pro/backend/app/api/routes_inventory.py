@router.get("/products/export/csv", summary="Exportar produtos para CSV")
async def export_products_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> StreamingResponse:
    deps.ensure_permission(current_user, "product.manage")
    result = await db.execute(select(Product).order_by(Product.code.asc()))
    products = result.scalars().all()
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    
    # Header
    writer.writerow(["CODE", "NAME", "SKU", "EAN", "CATEGORY", "FAMILY", "SUPPLIER", "UNIT", "BRAND", "PERISHABLE", "EXPIRY_CONTROL"])
    
    for p in products:
        writer.writerow([
            p.code, p.name or "", p.sku or "", p.ean or "", p.category or "", p.family or "",
            p.supplier or "", p.unit or "un", p.brand or "",
            "1" if p.is_perishable else "0", "1" if p.expiry_control else "0"
        ])
    
    output.seek(0)
    filename = f"products_export_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(io.BytesIO(output.getvalue().encode('utf-8-sig')), media_type="text/csv", headers=headers)

from typing import List, Optional
from datetime import date, datetime
from sqlalchemy import String, Integer, Float, ForeignKey, Date, DateTime, Text, Boolean, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.app.core.database import Base
from backend.app.models.base_class import TimestampMixin

class Depot(Base, TimestampMixin):
    __tablename__ = "depots"
    __table_args__ = (
        UniqueConstraint("name", name="uq_depots_name"),
    )
    name: Mapped[str] = mapped_column(String, index=True)
    address: Mapped[Optional[str]] = mapped_column(String)
    city: Mapped[Optional[str]] = mapped_column(String)
    manager: Mapped[Optional[str]] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    allow_overcapacity: Mapped[bool] = mapped_column(Boolean, default=False)
    
    shelves: Mapped[List["Shelf"]] = relationship(back_populates="depot", cascade="all, delete-orphan")

class Shelf(Base, TimestampMixin):
    __tablename__ = "shelves"
    __table_args__ = (
        UniqueConstraint("depot_id", "code", name="uq_shelves_depot_code"),
        CheckConstraint("shelf_type in ('normal', 'quarantine', 'blocked')", name="ck_shelves_type_valid"),
        CheckConstraint("floors > 0", name="ck_shelves_floors_positive"),
        CheckConstraint("drawers_per_floor > 0", name="ck_shelves_drawers_positive"),
        CheckConstraint("max_kg_per_drawer > 0", name="ck_shelves_max_kg_positive"),
    )
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    code: Mapped[str] = mapped_column(String)  # "A", "B"
    shelf_type: Mapped[str] = mapped_column(String, default="normal")
    floors: Mapped[int] = mapped_column(Integer)
    drawers_per_floor: Mapped[int] = mapped_column(Integer)
    max_kg_per_drawer: Mapped[float] = mapped_column(Float, default=50.0)
    
    depot: Mapped["Depot"] = relationship(back_populates="shelves")
    drawers: Mapped[List["Drawer"]] = relationship(back_populates="shelf", cascade="all, delete-orphan")

class Drawer(Base, TimestampMixin):
    __tablename__ = "drawers"
    __table_args__ = (
        UniqueConstraint("shelf_id", "floor_number", "drawer_number", name="uq_drawers_shelf_position"),
        CheckConstraint("floor_number > 0", name="ck_drawers_floor_positive"),
        CheckConstraint("drawer_number > 0", name="ck_drawers_number_positive"),
    )
    shelf_id: Mapped[str] = mapped_column(ForeignKey("shelves.id"))
    floor_number: Mapped[int] = mapped_column(Integer)
    drawer_number: Mapped[int] = mapped_column(Integer)
    # Computed key (e.g., A1.G2) - stored for easy lookup or computed?
    # Better stored for indexing: shelf.code + floor + .G + drawer
    drawer_key: Mapped[str] = mapped_column(String, index=True) 
    
    shelf: Mapped["Shelf"] = relationship(back_populates="drawers")
    stock_items: Mapped[List["StockItem"]] = relationship(back_populates="drawer", cascade="all, delete-orphan")

class Product(Base, TimestampMixin):
    __tablename__ = "products"
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    sku: Mapped[Optional[str]] = mapped_column(String)
    ean: Mapped[Optional[str]] = mapped_column(String)
    category: Mapped[Optional[str]] = mapped_column(String)
    family: Mapped[Optional[str]] = mapped_column(String)
    supplier: Mapped[Optional[str]] = mapped_column(String)
    unit: Mapped[Optional[str]] = mapped_column(String) # un, cx, kg
    brand: Mapped[Optional[str]] = mapped_column(String)
    manufacturer: Mapped[Optional[str]] = mapped_column(String)
    model: Mapped[Optional[str]] = mapped_column(String)
    ncm: Mapped[Optional[str]] = mapped_column(String)
    anvisa: Mapped[Optional[str]] = mapped_column(String)
    temp_min: Mapped[Optional[float]] = mapped_column(Float)
    temp_max: Mapped[Optional[float]] = mapped_column(Float)
    min_stock: Mapped[Optional[int]] = mapped_column(Integer)
    max_stock: Mapped[Optional[int]] = mapped_column(Integer)
    reorder_point: Mapped[Optional[int]] = mapped_column(Integer)
    length_cm: Mapped[Optional[float]] = mapped_column(Float)
    width_cm: Mapped[Optional[float]] = mapped_column(Float)
    height_cm: Mapped[Optional[float]] = mapped_column(Float)
    is_perishable: Mapped[bool] = mapped_column(Boolean, default=False)
    serial_control: Mapped[Optional[str]] = mapped_column(String)
    expiry_control: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    stock_items: Mapped[List["StockItem"]] = relationship(back_populates="product")

class StockItem(Base, TimestampMixin):
    __tablename__ = "stock_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_items_quantity_positive"),
        CheckConstraint("kg >= 0", name="ck_stock_items_kg_non_negative"),
        Index("ix_stock_items_drawer_product_lot", "drawer_id", "product_id", "lot"),
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    drawer_id: Mapped[str] = mapped_column(ForeignKey("drawers.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    kg: Mapped[float] = mapped_column(Float, default=0.0)
    kg_per_unit: Mapped[Optional[float]] = mapped_column(Float)
    lot: Mapped[Optional[str]] = mapped_column(String)
    entry_date: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    product: Mapped["Product"] = relationship(back_populates="stock_items")
    drawer: Mapped["Drawer"] = relationship(back_populates="stock_items")
    expiries: Mapped[List["Expiry"]] = relationship(back_populates="stock_item", cascade="all, delete-orphan")

class Expiry(Base, TimestampMixin):
    __tablename__ = "expiries"
    __table_args__ = (
        UniqueConstraint("stock_item_id", "date_value", name="uq_expiries_stock_item_date"),
    )
    stock_item_id: Mapped[str] = mapped_column(ForeignKey("stock_items.id"))
    date_value: Mapped[date] = mapped_column(Date)
    
    stock_item: Mapped["StockItem"] = relationship(back_populates="expiries")


class InventoryMovement(Base, TimestampMixin):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        Index("ix_inventory_movements_product_drawer_happened", "product_code", "drawer_key", "happened_at"),
    )
    action: Mapped[str] = mapped_column(String, index=True)
    icon: Mapped[Optional[str]] = mapped_column(String)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    username: Mapped[Optional[str]] = mapped_column(String, index=True)
    depot_id: Mapped[Optional[str]] = mapped_column(ForeignKey("depots.id"))
    drawer_key: Mapped[Optional[str]] = mapped_column(String, index=True)
    product_code: Mapped[Optional[str]] = mapped_column(String, index=True)
    payload_json: Mapped[Optional[str]] = mapped_column(Text)


class StockQualityState(Base, TimestampMixin):
    __tablename__ = "stock_quality_states"
    __table_args__ = (
        UniqueConstraint("stock_item_id", name="uq_stock_quality_states_stock_item"),
        Index("ix_stock_quality_states_depot_expiry_computed", "depot_id", "expiry_status", "computed_at"),
    )
    stock_item_id: Mapped[str] = mapped_column(ForeignKey("stock_items.id"), index=True)
    depot_id: Mapped[Optional[str]] = mapped_column(ForeignKey("depots.id"), index=True)
    shelf_id: Mapped[Optional[str]] = mapped_column(ForeignKey("shelves.id"), index=True)
    drawer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("drawers.id"), index=True)
    drawer_key: Mapped[Optional[str]] = mapped_column(String, index=True)
    product_code: Mapped[Optional[str]] = mapped_column(String, index=True)
    shelf_type: Mapped[str] = mapped_column(String, default="normal", index=True)
    nearest_expiry: Mapped[Optional[date]] = mapped_column(Date, index=True)
    expiry_status: Mapped[str] = mapped_column(String, default="none", index=True)
    days_to_expiry: Mapped[Optional[int]] = mapped_column(Integer)
    days_overdue: Mapped[Optional[int]] = mapped_column(Integer)
    has_expiry: Mapped[bool] = mapped_column(Boolean, default=False)
    is_quarantine: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class QualitySummary(Base, TimestampMixin):
    __tablename__ = "quality_summaries"
    __table_args__ = (
        UniqueConstraint("scope_type", "scope_id", name="uq_quality_summaries_scope"),
    )
    scope_type: Mapped[str] = mapped_column(String, index=True)  # global | depot
    scope_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    label: Mapped[Optional[str]] = mapped_column(String)
    expired_count: Mapped[int] = mapped_column(Integer, default=0)
    expiring_count: Mapped[int] = mapped_column(Integer, default=0)
    quarantine_count: Mapped[int] = mapped_column(Integer, default=0)
    blocked_count: Mapped[int] = mapped_column(Integer, default=0)
    short_expiry_count: Mapped[int] = mapped_column(Integer, default=0)
    overdue_total_days: Mapped[int] = mapped_column(Integer, default=0)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

from __future__ import annotations
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy import String, Integer, Float, ForeignKey, Date, DateTime, Text, Boolean, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from ..core.database import Base, TimestampMixin

class Depot(Base, TimestampMixin):
    __tablename__ = "depots"
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    address: Mapped[Optional[str]] = mapped_column(String)
    allow_overcapacity: Mapped[bool] = mapped_column(Boolean, default=False)
    
    shelves: Mapped[List["Shelf"]] = relationship(back_populates="depot", cascade="all, delete-orphan")

class Shelf(Base, TimestampMixin):
    __tablename__ = "shelves"
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    code: Mapped[str] = mapped_column(String) # A, B, C
    floors: Mapped[int] = mapped_column(Integer)
    drawers_per_floor: Mapped[int] = mapped_column(Integer)
    max_kg_per_drawer: Mapped[float] = mapped_column(Float, default=50.0)
    
    depot: Mapped["Depot"] = relationship(back_populates="shelves")
    drawers: Mapped[List["Drawer"]] = relationship(back_populates="shelf", cascade="all, delete-orphan")

class Drawer(Base, TimestampMixin):
    __tablename__ = "drawers"
    shelf_id: Mapped[str] = mapped_column(ForeignKey("shelves.id"))
    floor_number: Mapped[int] = mapped_column(Integer)
    drawer_number: Mapped[int] = mapped_column(Integer)
    drawer_key: Mapped[str] = mapped_column(String, index=True, unique=True) # Ex: A1-G1
    
    shelf: Mapped["Shelf"] = relationship(back_populates="drawers")
    stock_items: Mapped[List["StockItem"]] = relationship(back_populates="drawer", cascade="all, delete-orphan")

class Product(Base, TimestampMixin):
    __tablename__ = "products"
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    sku: Mapped[Optional[str]] = mapped_column(String)
    category: Mapped[Optional[str]] = mapped_column(String)
    is_perishable: Mapped[bool] = mapped_column(Boolean, default=False)
    expiry_control: Mapped[bool] = mapped_column(Boolean, default=True)
    
    stock_items: Mapped[List["StockItem"]] = relationship(back_populates="product")

class StockItem(Base, TimestampMixin):
    __tablename__ = "stock_items"
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    drawer_id: Mapped[str] = mapped_column(ForeignKey("drawers.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    lot: Mapped[Optional[str]] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="AVAILABLE")
    
    product: Mapped["Product"] = relationship(back_populates="stock_items")
    drawer: Mapped["Drawer"] = relationship(back_populates="stock_items")
    expiries: Mapped[List["Expiry"]] = relationship(back_populates="stock_item", cascade="all, delete-orphan")

class Expiry(Base, TimestampMixin):
    __tablename__ = "expiries"
    stock_item_id: Mapped[str] = mapped_column(ForeignKey("stock_items.id"))
    date_value: Mapped[date] = mapped_column(Date, index=True)
    
    stock_item: Mapped["StockItem"] = relationship(back_populates="expiries")

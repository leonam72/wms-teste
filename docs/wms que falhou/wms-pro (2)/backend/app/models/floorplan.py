from typing import Optional
from sqlalchemy import String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base
from backend.app.models.base_class import TimestampMixin

class FloorPlanShelf(Base, TimestampMixin):
    __tablename__ = "floorplan_shelves"
    __table_args__ = (
        UniqueConstraint("depot_id", "shelf_id", name="uq_floorplan_shelves_depot_shelf"),
    )
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    shelf_id: Mapped[str] = mapped_column(ForeignKey("shelves.id"))
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    rotation: Mapped[float] = mapped_column(Float, default=0.0)

class FloorPlanObject(Base, TimestampMixin):
    __tablename__ = "floorplan_objects"
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    obj_type: Mapped[str] = mapped_column(String) # textbox, street, zone, blocked, entry
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    w: Mapped[float] = mapped_column(Float)
    h: Mapped[float] = mapped_column(Float)
    text: Mapped[Optional[str]] = mapped_column(String)
    style_class: Mapped[Optional[str]] = mapped_column(String)

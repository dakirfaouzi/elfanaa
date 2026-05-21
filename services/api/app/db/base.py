"""SQLAlchemy declarative base — imported by every model."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Project-wide declarative base. Models inherit from this."""

    pass

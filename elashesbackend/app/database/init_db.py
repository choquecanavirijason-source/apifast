from app.database import engine, Base

from app.models.branch import Branch
from app.models.user import User, Role, Permission
from app.models.client import Client
from app.models.inventory import Category, Product, Batch, InventoryMovement
from app.models.tracking import (
    Tracking,
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Questionnaire,
    Question,
)
from app.models.service_agenda import ServiceCategory, Service, Appointment
from app.models.payment import Payment
from app.models.pos_sale import PosSale


def init_db():
    Base.metadata.create_all(bind=engine)
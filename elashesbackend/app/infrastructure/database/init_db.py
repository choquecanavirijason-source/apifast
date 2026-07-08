from app.infrastructure.database import engine, Base

from app.domain.entities.branch_integration_profile import BranchIntegrationProfile
from app.domain.entities.admin_ai_settings import AdminAiSettings
from app.domain.entities.branch import Branch
from app.domain.entities.user import User, Role, Permission
from app.domain.entities.client import Client
from app.domain.entities.inventory import Category, Product, Batch, InventoryMovement
from app.domain.entities.tracking import (
    Tracking,
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Questionnaire,
    Question,
)
from app.domain.entities.lash_design_final import Tecnologia, DisenoFinal, DisenoGuardado
from app.domain.entities.service_agenda import ServiceCategory, Service, Appointment
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.cash_close import CashClose, CommissionReceipt
from app.domain.entities.commission_payment import CommissionPayment


def init_db():
    Base.metadata.create_all(bind=engine)
from typing import List, Optional, Type, Any
from sqlalchemy.orm import Session
from app.database.session import SessionLocal

class ItemRepository:
    """Repositorio genérico para manejar cualquier tabla de catálogo"""
    
    def create(self, model: Type[Any], item_data: dict) -> Any:
        """Crea un nuevo registro en la tabla especificada por 'model'"""
        db: Session = SessionLocal()
        try:
            db_item = model(**item_data)
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            return db_item
        finally:
            db.close()
    
    def get_by_id(self, model: Type[Any], item_id: int) -> Optional[Any]:
        """Obtiene un registro por ID de una tabla específica"""
        db: Session = SessionLocal()
        try:
            return db.query(model).filter(model.id == item_id).first()
        finally:
            db.close()
    
    def get_all(self, model: Type[Any], skip: int = 0, limit: int = 100) -> List[Any]:
        """Obtiene todos los registros de una tabla con paginación"""
        db: Session = SessionLocal()
        try:
            return db.query(model).offset(skip).limit(limit).all()
        finally:
            db.close()
    
    def update(self, model: Type[Any], item_id: int, item_data: dict) -> Optional[Any]:
        """Actualiza un registro existente de forma dinámica"""
        db: Session = SessionLocal()
        try:
            db_item = db.query(model).filter(model.id == item_id).first()
            if not db_item:
                return None
            
            # Actualizamos solo los campos que vienen en el diccionario
            for key, value in item_data.items():
                if hasattr(db_item, key):
                    setattr(db_item, key, value)
            
            db.commit()
            db.refresh(db_item)
            return db_item
        finally:
            db.close()
    
    def delete(self, model: Type[Any], item_id: int) -> bool:
        """Elimina un registro de la tabla especificada"""
        db: Session = SessionLocal()
        try:
            db_item = db.query(model).filter(model.id == item_id).first()
            if not db_item:
                return False
            
            db.delete(db_item)
            db.commit()
            return True
        finally:
            db.close()

    def search(self, model: Type[Any], query: str) -> List[Any]:
        """Busca por nombre o descripción en la tabla especificada"""
        db: Session = SessionLocal()
        try:
            search_pattern = f"%{query}%"
            return db.query(model).filter(
                (model.name.ilike(search_pattern)) | 
                (model.description.ilike(search_pattern))
            ).all()
        finally:
            db.close()

# Instancia global del repositorio
item_repository = ItemRepository()
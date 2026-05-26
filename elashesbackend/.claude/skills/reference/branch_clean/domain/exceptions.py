"""
Excepciones de dominio. NO heredan de HTTPException — son agnósticas del transporte.
El controller las traduce a status HTTP. Esto permite reusar el service desde
un CLI, un job en background, o un test sin acoplarse a FastAPI.
"""


class DomainError(Exception):
    """Raíz de todos los errores de dominio."""


class BranchNotFound(DomainError):
    def __init__(self, branch_id: int) -> None:
        super().__init__(f"Sucursal {branch_id} no encontrada")
        self.branch_id = branch_id


class BranchNameConflict(DomainError):
    def __init__(self, name: str) -> None:
        super().__init__(f"Ya existe una sucursal con nombre '{name}'")
        self.name = name


class BranchInUse(DomainError):
    def __init__(self, branch_id: int) -> None:
        super().__init__(f"La sucursal {branch_id} está en uso y no puede eliminarse")
        self.branch_id = branch_id


class UsersNotFound(DomainError):
    def __init__(self, missing_ids: list[int]) -> None:
        super().__init__(f"Usuarios no encontrados: {missing_ids}")
        self.missing_ids = missing_ids

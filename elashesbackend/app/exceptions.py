"""
Excepciones personalizadas para la aplicación
"""


class ItemNotFoundError(Exception):
    """Excepción cuando no se encuentra un item"""
    pass


class ItemValidationError(Exception):
    """Excepción para errores de validación de items"""
    pass


class BusinessLogicError(Exception):
    """Excepción para errores de lógica de negocio"""
    pass

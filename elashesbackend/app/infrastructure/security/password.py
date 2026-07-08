"""Hashing y verificación de passwords usando bcrypt directo.

Nota: passlib 1.7.4 es incompatible con bcrypt >= 4.1 (lanza
"password cannot be longer than 72 bytes" incluso con passwords cortos).
Se usa el paquete bcrypt directamente para evitar ese bug, igual que en
backend_marketplace. Los hashes existentes generados por passlib siguen
siendo hashes bcrypt estándar ($2b$...), así que son compatibles sin
necesidad de migrar datos.
"""
import bcrypt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")

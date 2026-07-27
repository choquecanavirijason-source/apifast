# Mismo listado de países que adminElashes/src/pages/admin/salons/utils.ts
# (COUNTRY_CITY_OPTIONS) — el admin elige el país por nombre en ese dropdown
# (guardado en Branch.department); este módulo es la única fuente de la
# derivación nombre→código ISO para no duplicarla entre el servicio y la
# migración.
COUNTRY_NAME_TO_CODE = {
    "bolivia": "BO",
    "argentina": "AR",
    "chile": "CL",
    "peru": "PE",
    "paraguay": "PY",
    "uruguay": "UY",
    "brasil": "BR",
    "colombia": "CO",
    "ecuador": "EC",
    "venezuela": "VE",
    "mexico": "MX",
    "estados unidos": "US",
    "canada": "CA",
    "espana": "ES",
    "francia": "FR",
    "italia": "IT",
    "alemania": "DE",
    "reino unido": "GB",
    "portugal": "PT",
    "japon": "JP",
}

# Derivado del mapeo de arriba — nunca se desincroniza porque no es una
# copia mantenida a mano, es el mismo diccionario invertido.
COUNTRY_CODE_TO_NAME = {code: name.title() for name, code in COUNTRY_NAME_TO_CODE.items()}

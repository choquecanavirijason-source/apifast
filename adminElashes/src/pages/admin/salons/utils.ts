export type Salon = {
  id: number;
  name: string;
  address: string;
  city: string;
  department: string;
  active: boolean;
  createdAt: string;
};

export type SalonForm = {
  name: string;
  address: string;
  city: string;
  department: string;
};

export interface BackendBranch {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  department?: string | null;
}

export const emptyForm: SalonForm = {
  name: "",
  address: "",
  city: "",
  department: "",
};

export const mapBranchToSalon = (branch: BackendBranch): Salon => ({
  id: branch.id,
  name: branch.name,
  address: branch.address ?? "",
  city: branch.city ?? "",
  department: branch.department ?? "",
  active: true,
  createdAt: "",
});

export const COUNTRY_CITY_OPTIONS: Record<string, string[]> = {
  "Bolivia": [
    "Santa Cruz de la Sierra",
    "La Paz",
    "Cochabamba",
    "Sucre",
    "Tarija",
    "Oruro",
    "Potosi",
    "Trinidad",
    "Cobija",
    "Montero",
    "Warnes",
    "Yacuiba",
  ],
  "Argentina": ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "La Plata", "Salta"],
  "Chile": ["Santiago", "Valparaiso", "Concepcion", "Antofagasta", "La Serena", "Temuco"],
  "Peru": ["Lima", "Arequipa", "Cusco", "Trujillo", "Piura", "Chiclayo"],
  "Paraguay": ["Asuncion", "Ciudad del Este", "Encarnacion", "Luque", "San Lorenzo"],
  "Uruguay": ["Montevideo", "Salto", "Paysandu", "Maldonado", "Rivera"],
  "Brasil": ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Belo Horizonte", "Curitiba", "Porto Alegre"],
  "Colombia": ["Bogota", "Medellin", "Cali", "Barranquilla", "Cartagena", "Bucaramanga"],
  "Ecuador": ["Quito", "Guayaquil", "Cuenca", "Manta", "Loja"],
  "Venezuela": ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Merida"],
  "Mexico": ["Ciudad de Mexico", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "Merida"],
  "Estados Unidos": ["New York", "Los Angeles", "Miami", "Houston", "Chicago", "San Francisco"],
  "Canada": ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa"],
  "Espana": ["Madrid", "Barcelona", "Valencia", "Sevilla", "Malaga", "Bilbao"],
  "Francia": ["Paris", "Lyon", "Marsella", "Toulouse", "Niza"],
  "Italia": ["Roma", "Milan", "Napoles", "Turin", "Florencia"],
  "Alemania": ["Berlin", "Hamburgo", "Munich", "Colonia", "Frankfurt"],
  "Reino Unido": ["Londres", "Manchester", "Birmingham", "Glasgow", "Liverpool"],
  "Portugal": ["Lisboa", "Oporto", "Braga", "Coimbra", "Faro"],
  "Japon": ["Tokyo", "Osaka", "Kyoto", "Yokohama", "Nagoya"],
};

export const COUNTRY_OPTIONS = Object.keys(COUNTRY_CITY_OPTIONS);

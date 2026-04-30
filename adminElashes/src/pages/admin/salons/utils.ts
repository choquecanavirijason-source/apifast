export type Salon = {
  id: number;
  name: string;
  address: string;
  city: string;
  department: string;
  opening_hours: SalonDayScheduleForm[];
  active: boolean;
  createdAt: string;
};

export type SalonTimeRangeForm = {
  open_time: string;
  close_time: string;
};

export type SalonDayScheduleForm = {
  day: string;
  ranges: SalonTimeRangeForm[];
};

export type SalonForm = {
  name: string;
  address: string;
  city: string;
  department: string;
  opening_hours: SalonDayScheduleForm[];
};

export interface BackendBranch {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  opening_hours?: SalonDayScheduleForm[] | string | null;
}

export const WEEK_DAYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export const createDefaultOpeningHours = (): SalonDayScheduleForm[] =>
  WEEK_DAYS.map((day) => ({
    day,
    ranges: [{ open_time: "", close_time: "" }],
  }));

const normalizeOpeningHours = (rawValue: BackendBranch["opening_hours"]): SalonDayScheduleForm[] => {
  const fallback = createDefaultOpeningHours();
  if (!rawValue) return fallback;

  let parsedValue: unknown = rawValue;
  if (typeof rawValue === "string") {
    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      return fallback;
    }
  }

  if (!Array.isArray(parsedValue)) return fallback;

  const byDay = new Map(
    fallback.map((item) => [item.day, { ...item, ranges: [...item.ranges] }])
  );

  parsedValue.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const day = "day" in item && typeof item.day === "string" ? item.day.toLowerCase().trim() : "";
    if (!byDay.has(day)) return;
    const rawRanges = "ranges" in item && Array.isArray(item.ranges) ? item.ranges : [];
    const ranges = rawRanges
      .map((range) => {
        if (!range || typeof range !== "object") return null;
        const open_time =
          "open_time" in range && typeof range.open_time === "string" ? range.open_time.trim() : "";
        const close_time =
          "close_time" in range && typeof range.close_time === "string" ? range.close_time.trim() : "";
        return { open_time, close_time };
      })
      .filter((range): range is SalonTimeRangeForm => range !== null)
      .slice(0, 2);

    byDay.set(day, {
      day,
      ranges: ranges.length > 0 ? ranges : [{ open_time: "", close_time: "" }],
    });
  });

  return WEEK_DAYS.map((day) => byDay.get(day) ?? { day, ranges: [{ open_time: "", close_time: "" }] });
};

export const emptyForm: SalonForm = {
  name: "",
  address: "",
  city: "",
  department: "",
  opening_hours: createDefaultOpeningHours(),
};

export const mapBranchToSalon = (branch: BackendBranch): Salon => ({
  id: branch.id,
  name: branch.name,
  address: branch.address ?? "",
  city: branch.city ?? "",
  department: branch.department ?? "",
  opening_hours: normalizeOpeningHours(branch.opening_hours),
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

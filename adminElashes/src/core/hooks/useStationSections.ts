import { useState, useEffect } from "react";

export type StationSection = {
  id: string;
  label: string;
  count: number;
  headerBg: string;
  headerText: string;
  labelBg: string;
};

export const SECTION_PALETTE = [
  { headerBg: "#fde8f0", headerText: "#861237", labelBg: "#f5c6dc", name: "Rosa" },
  { headerBg: "#ddeeff", headerText: "#004578", labelBg: "#b8d6f0", name: "Azul" },
  { headerBg: "#e8f5e9", headerText: "#1b5e20", labelBg: "#a5d6a7", name: "Verde" },
  { headerBg: "#fff3e0", headerText: "#bf5000", labelBg: "#ffcc80", name: "Naranja" },
  { headerBg: "#f3e5f5", headerText: "#4a148c", labelBg: "#ce93d8", name: "Morado" },
  { headerBg: "#e0f2f1", headerText: "#004d40", labelBg: "#80cbc4", name: "Teal" },
  { headerBg: "#ffebee", headerText: "#b71c1c", labelBg: "#ef9a9a", name: "Rojo" },
  { headerBg: "#fffde7", headerText: "#e65100", labelBg: "#fff176", name: "Amarillo" },
];

const SECTIONS_KEY = "agenda:station_sections";
const SECTIONS_EVENT = "stationsectionschange";

export const DEFAULT_SECTIONS: StationSection[] = [
  { id: "s1", label: "Lifting de Pestañas", count: 4, ...SECTION_PALETTE[0] },
  { id: "s2", label: "Extensiones",         count: 4, ...SECTION_PALETTE[1] },
];

function readFromStorage(): StationSection[] {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const parsed = JSON.parse(raw) as StationSection[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* noop */ }
  return DEFAULT_SECTIONS;
}

export function useStationSections() {
  const [sections, setSections] = useState<StationSection[]>(readFromStorage);

  useEffect(() => {
    const sync = () => setSections(readFromStorage());
    window.addEventListener(SECTIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SECTIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saveSections = (next: StationSection[]) => {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
    } catch { /* noop */ }
    setSections(next);
    window.dispatchEvent(new CustomEvent(SECTIONS_EVENT));
  };

  const totalStations = sections.reduce((s, sec) => s + sec.count, 0);

  return { sections, saveSections, totalStations };
}

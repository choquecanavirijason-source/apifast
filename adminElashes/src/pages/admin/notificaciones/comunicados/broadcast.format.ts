import { parseUtc } from "../notificaciones.utils";

// Hora de La Paz, como el resto del panel, aunque la PC tenga otra zona.
const dateTimeFormat = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/La_Paz",
});

export const formatBroadcastDate = (isoUtc: string) => dateTimeFormat.format(parseUtc(isoUtc));

export const clientasLabel = (count: number) => `${count} ${count === 1 ? "clienta" : "clientas"}`;

type ColFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ColFilter({ value, onChange }: ColFilterProps) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Filtrar..."
      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 placeholder-slate-400 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-1 focus:ring-slate-200"
    />
  );
}

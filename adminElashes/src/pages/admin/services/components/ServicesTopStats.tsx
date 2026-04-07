import { Briefcase } from "lucide-react";

import { StatCard } from "../../../../components/common/ui";

export type ServicesTopStatsProps = {
  totalCategories: number;
  totalServices: number;
  totalWithImage: number;
  totalWithDescription: number;
};

export default function ServicesTopStats({
  totalCategories,
  totalServices,
  totalWithImage,
  totalWithDescription,
}: ServicesTopStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total categorias" value={totalCategories} icon={<Briefcase className="h-4 w-4" />} tone="slate" />
      <StatCard label="Total servicios" value={totalServices} icon={<Briefcase className="h-4 w-4" />} tone="sky" />
      <StatCard
        label="Con imagen"
        value={totalWithImage}
        icon={<Briefcase className="h-4 w-4" />}
        tone="emerald"
      />
      <StatCard label="Con descripcion" value={totalWithDescription} icon={<Briefcase className="h-4 w-4" />} tone="amber" />
    </div>
  );
}

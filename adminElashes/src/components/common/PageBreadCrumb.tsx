import React from "react";

interface PageBreadcrumbProps {
  pageTitle: string;
}

const PageBreadcrumb: React.FC<PageBreadcrumbProps> = ({ pageTitle }) => {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
      {/* Aquí puedes agregar breadcrumbs si lo deseas */}
    </div>
  );
};

export default PageBreadcrumb;

import { useState, useEffect, useRef } from "react";
import type { IPagination, IPaginationRequest } from "@/core/types/IApi";

const defaultPagination = {
  total: 0,
  count: 0,
  per_page: 10,
  current_page: 1,
  total_pages: 1,
};

type ServiceWithId<T> = {
  getAllPaginated: (
    id: any,
    params?: IPaginationRequest, 
    config?: { signal?: AbortSignal }
  ) => Promise<{
    success: boolean;
    data: T[];
    meta?: { pagination: IPagination };
  }>;
};

type ServiceWithoutId<T> = {
  getAllPaginated: (
    params?: IPaginationRequest, 
    config?: { signal?: AbortSignal }
  ) => Promise<{
    success: boolean;
    data: T[];
    meta?: { pagination: IPagination };
  }>;
};

type ServiceType<T> = ServiceWithId<T> | ServiceWithoutId<T>;

interface UseResourceOptions<T> {
  service: ServiceType<T>;
  resourceId?: any;
  initialFilters?: Record<string, string>;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  defaultPerPage?: number;
}

export const useResource = <T>({
  service,
  resourceId,
  initialFilters = {},
  defaultSort = { key: 'id', direction: 'asc' },
  defaultPerPage = 10,
}: UseResourceOptions<T>) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<IPagination>({
    ...defaultPagination,
    per_page: defaultPerPage,
  });
  const [sort, setSort] = useState(defaultSort);
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchItems = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setLoading(true);
    try {
      const params: IPaginationRequest = {
        page: pagination.current_page,
        limit: pagination.per_page,
        search: searchInput,
        sortBy: {
          sort: sort.key,
          order: sort.direction,
        },
        ...filters,
      };

      let response;
      if (resourceId !== undefined) {
        response = await (service as ServiceWithId<T>).getAllPaginated(
          resourceId, 
          params, 
          { signal: abortController.signal }
        );
      } else {
        response = await (service as ServiceWithoutId<T>).getAllPaginated(
          params, 
          { signal: abortController.signal }
        );
      }

      if (!abortController.signal.aborted && response.success) {
        console.log('✅ Response from API:', response);
        console.log('✅ Data received:', response.data);
        console.log('✅ Data is array?:', Array.isArray(response.data));
        
        // Validar que response.data sea un array
        const dataArray = Array.isArray(response.data) ? response.data : [];
        setItems(dataArray);
        
        setPagination(response.meta?.pagination || {
          ...defaultPagination,
          per_page: pagination.per_page,
        });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ Error fetching items:', error);
        console.error('❌ Error response:', error.response?.data);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchItems();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [resourceId, pagination.current_page, pagination.per_page, sort, filters, searchInput]);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };

  const handleSortChange = (newSort: typeof sort) => {
    setSort(newSort);
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({
      ...prev,
      per_page: limit,
      current_page: 1,
    }));
  };

  const handleSearch = (query: string) => {
    setSearchInput(query);
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  return {
    items,
    loading,
    pagination,
    sort,
    filters,
    searchInput,
    setItems,
    setPagination,
    setSort,
    setFilters,
    setSearchInput,
    fetchItems,
    handlePageChange,
    handleSortChange,
    handleFilterChange,
    handleLimitChange,
    handleSearch,
  };
};
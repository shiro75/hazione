/**
 * @fileoverview Reusable app-level hooks for responsive breakpoints,
 * currency retrieval, and generic list filtering with search.
 */
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useData } from '@/contexts/DataContext';

export function useIsMobile(breakpoint: number = 768): boolean {
  const { width } = useWindowDimensions();
  return width < breakpoint;
}

export function useCurrency(): string {
  const { company } = useData();
  return company.currency || 'EUR';
}

export function useFilteredList<T>(
  list: T[],
  search: string,
  searchFields: (item: T) => string[],
): T[] {
  return useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((item) =>
      searchFields(item).some((field) => field.toLowerCase().includes(q))
    );
  }, [list, search, searchFields]);
}

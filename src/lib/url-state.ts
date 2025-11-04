import { useSearchParams } from 'react-router';
import { useMemo, useCallback } from 'react';
import { z } from 'zod';

/**
 * Hook for managing complex filter state in URL search params
 *
 * Example usage:
 * ```tsx
 * const filterSchema = z.object({
 *   status: z.enum(['active', 'inactive', 'all']).default('all'),
 *   search: z.string().default(''),
 *   tags: z.array(z.string()).default([]),
 *   dateRange: z.object({
 *     from: z.string().optional(),
 *     to: z.string().optional(),
 *   }).default({}),
 * });
 *
 * function ProjectsPage() {
 *   const [filters, setFilters] = useUrlState(filterSchema);
 *
 *   return (
 *     <div>
 *       <input
 *         value={filters.search}
 *         onChange={e => setFilters({ search: e.target.value })}
 *       />
 *       <select
 *         value={filters.status}
 *         onChange={e => setFilters({ status: e.target.value })}
 *       >
 *         <option value="all">All</option>
 *         <option value="active">Active</option>
 *         <option value="inactive">Inactive</option>
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUrlState<T extends z.ZodObject<any>>(
  schema: T
): [z.infer<T>, (updates: Partial<z.infer<T>>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current URL params into typed object
  const state = useMemo(() => {
    const raw: Record<string, any> = {};

    for (const [key, value] of searchParams.entries()) {
      // Handle arrays (e.g., ?tags=foo&tags=bar)
      if (raw[key]) {
        raw[key] = Array.isArray(raw[key]) ? [...raw[key], value] : [raw[key], value];
      } else {
        raw[key] = value;
      }
    }

    // Parse JSON values (for complex objects)
    Object.keys(raw).forEach((key) => {
      if (typeof raw[key] === 'string' && raw[key].startsWith('{')) {
        try {
          raw[key] = JSON.parse(raw[key]);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
    });

    // Validate and apply defaults
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : schema.parse({});
  }, [searchParams, schema]);

  // Update URL params (merge with existing)
  const setState = useCallback(
    (updates: Partial<z.infer<T>>) => {
      const newState = { ...state, ...updates };
      const newParams = new URLSearchParams();

      Object.entries(newState).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        if (Array.isArray(value)) {
          value.forEach((v) => newParams.append(key, String(v)));
        } else if (typeof value === 'object') {
          newParams.set(key, JSON.stringify(value));
        } else {
          newParams.set(key, String(value));
        }
      });

      setSearchParams(newParams, { replace: true });
    },
    [state, setSearchParams]
  );

  // Clear all filters
  const clearState = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return [state, setState, clearState];
}

/**
 * Generate shareable URL with current filters
 */
export function useShareableUrl(): string {
  const [searchParams] = useSearchParams();
  return `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`;
}

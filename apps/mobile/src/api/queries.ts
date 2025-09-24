import { QueryClient, useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Slider, Restaurant, TransportRoute, ExplorePlace } from '../types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes, garbage collect after > 24h
      staleTime: 300_000,
      gcTime: 24 * 60 * 60 * 1000 + 60_000,
      // Retry only on server errors (>=500)
      retry: (failureCount, error: any) => {
        const status = (error?.status as number) ?? 0;
        if (status >= 500) return failureCount < 1;
        return false;
      },
      placeholderData: keepPreviousData,
      networkMode: 'offlineFirst',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      throwOnError: false,
    },
  },
});

// Types imported from shared types

// Keys
const keys = {
  sliders: ['sliders'] as const,
  restaurants: (cuisine?: string, q?: string) => ['restaurants', { cuisine: cuisine || '', q: q || '' }] as const,
  restaurantDetail: (id: string) => ['restaurants', 'detail', id] as const,
  routes: (series?: string) => ['routes', { series: series || '' }] as const,
  routeDetail: (code: string) => ['routes', 'detail', code] as const,
  explore: (category?: string, q?: string) => ['explore', { category: category || '', q: q || '' }] as const,
  exploreDetail: (id: string) => ['explore', 'detail', id] as const,
};

// Sliders
export function useSliders() {
  return useQuery({
    queryKey: keys.sliders,
    queryFn: () => apiFetch<Slider[]>('/api/sliders?published=true'),
    meta: { description: 'sliders' },
  });
}

// Restaurants
export function useRestaurants(params: { cuisine?: string; q?: string } = {}) {
  const { cuisine = '', q = '' } = params;
  const search = new URLSearchParams({ published: 'true', cuisine, q });
  return useQuery({
    queryKey: keys.restaurants(cuisine, q),
    queryFn: () => apiFetch<Restaurant[]>(`/api/restaurants?${search.toString()}`),
    meta: { description: 'restaurants' },
  });
}

export function useRestaurantDetail(id: string) {
  return useQuery({
    enabled: !!id,
    queryKey: keys.restaurantDetail(id),
    queryFn: () => apiFetch<Restaurant>(`/api/restaurants/${id}`),
    meta: { description: 'restaurantDetail' },
    retry: (count, err: any) => (err?.status ?? 0) >= 500 && count < 1,
  });
}

// Routes
export function useRoutes(series?: string) {
  const search = new URLSearchParams({ series: series || '', published: 'true' });
  return useQuery({
    queryKey: keys.routes(series),
    queryFn: () => apiFetch<TransportRoute[]>(`/api/routes?${search.toString()}`),
    meta: { description: 'routes' },
  });
}

export function useRouteDetail(code: string) {
  return useQuery({
    enabled: !!code,
    queryKey: keys.routeDetail(code),
    queryFn: () => apiFetch<TransportRoute>(`/api/routes/${code}`),
    meta: { description: 'routeDetail' },
    retry: (count, err: any) => (err?.status ?? 0) >= 500 && count < 1,
  });
}

// Explore
export function useExplore(params: { category?: string; q?: string } = {}) {
  const { category = '', q = '' } = params;
  const search = new URLSearchParams({ category, q });
  return useQuery({
    queryKey: keys.explore(category, q),
    queryFn: () => apiFetch<ExplorePlace[]>(`/api/explore?${search.toString()}`),
    meta: { description: 'explore' },
  });
}

export function useExploreDetail(id: string) {
  return useQuery({
    enabled: !!id,
    queryKey: keys.exploreDetail(id),
    queryFn: () => apiFetch<any>(`/api/explore/${id}`),
    meta: { description: 'exploreDetail' },
    retry: (count, err: any) => (err?.status ?? 0) >= 500 && count < 1,
  });
}

// Initial prefetcher for app startup
export async function prefetchInitialData() {
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: keys.sliders, queryFn: () => apiFetch<Slider[]>('/api/sliders?published=true') }),
    queryClient.prefetchQuery({ queryKey: keys.restaurants('', ''), queryFn: () => apiFetch<Restaurant[]>(`/api/restaurants?published=true`) }),
    queryClient.prefetchQuery({ queryKey: keys.routes(''), queryFn: () => apiFetch<TransportRoute[]>(`/api/routes?published=true`) }),
  ]);
}



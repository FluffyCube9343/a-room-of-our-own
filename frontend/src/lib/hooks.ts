import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Page, Tag, User } from '../types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: User | null }>('/auth/me/'),
    retry: false,
  });
}
export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api<Page<Tag>>('/tags/'),
    staleTime: 300000,
  });
}
export function useApi<T>(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => api<T>(path), enabled });
}
export function useAction<T = unknown>() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => api<T>(path, method, body),
    onSuccess: async (_data, variables) => {
      // The blocked detail is about to disappear. Mark caches stale without
      // refetching that now-inaccessible page before navigation completes.
      await client.invalidateQueries(
        (variables.path.startsWith('/blocks/') && variables.method === 'PUT') ||
        (variables.path.startsWith('/connections/') && variables.method === 'PATCH' &&
          typeof variables.body === 'object' && variables.body !== null && 'action' in variables.body && variables.body.action === 'end')
          ? { refetchType: 'none' }
          : {},
      );
    },
  });
}

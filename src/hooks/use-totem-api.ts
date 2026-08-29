"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SyncPushBody, SyncPullQuery } from "@/generated/api-client";
import { queryKeys, totemApiClient } from "@/lib/api-query";

export function useShellBootstrap() {
  return useQuery({
    queryKey: queryKeys.shell.bootstrap(),
    queryFn: () => totemApiClient.shellBootstrap(),
  });
}

export function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.appConfig.detail(),
    queryFn: () => totemApiClient.appConfig(),
  });
}

export function useSyncBootstrap() {
  return useQuery({
    queryKey: queryKeys.sync.bootstrap(),
    queryFn: () => totemApiClient.syncBootstrap(),
  });
}

export function useSyncPull(params: SyncPullQuery = {}) {
  return useQuery({
    queryKey: queryKeys.sync.pull(params.cursor),
    queryFn: () => totemApiClient.syncPull(params),
  });
}

export function useSyncPushMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SyncPushBody) => totemApiClient.syncPush(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sync.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.shell.all });
    },
  });
}

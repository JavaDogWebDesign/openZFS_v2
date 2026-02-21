import { useState, useEffect, useCallback } from 'react';
import type { Pool, PoolDetail } from '@zfs-manager/shared';
import { poolApi } from '@/api/endpoints';

interface UsePoolsReturn {
  pools: Pool[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing the list of ZFS pools.
 */
export function usePools(): UsePoolsReturn {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await poolApi.list();
    if (result.success) {
      setPools(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { pools, isLoading, error, refetch };
}

interface UsePoolDetailReturn {
  pool: PoolDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching detailed information about a specific pool.
 */
export function usePoolDetail(name: string): UsePoolDetailReturn {
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!name) return;
    setIsLoading(true);
    setError(null);
    const result = await poolApi.get(name);
    if (result.success) {
      setPool(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [name]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { pool, isLoading, error, refetch };
}

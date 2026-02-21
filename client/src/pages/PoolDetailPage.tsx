import { useParams } from 'react-router-dom';
import { usePoolDetail } from '@/hooks/useZfsPool';
import { PoolDetail } from '@/components/pools/PoolDetail';

export function PoolDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { pool, isLoading, error, refetch } = usePoolDetail(name ?? '');

  return (
    <PoolDetail
      pool={pool}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
    />
  );
}

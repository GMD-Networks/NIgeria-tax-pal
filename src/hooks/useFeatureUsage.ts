import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { backendService } from '@/services/backend';
import type { FeatureType, UsageCheckResult, SUBSCRIPTION_CONFIG } from '@/types/subscription';
import { SUBSCRIPTION_CONFIG as CONFIG } from '@/types/subscription';

interface UseFeatureUsageReturn {
  canUse: boolean;
  currentUsage: number;
  limit: number;
  isUnlimited: boolean;
  isLoading: boolean;
  error: string | null;
  incrementUsage: () => Promise<boolean>;
  refreshUsage: () => Promise<void>;
}

export function useFeatureUsage(featureType: FeatureType): UseFeatureUsageReturn {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageCheckResult>({
    canUse: true,
    currentUsage: 0,
    limit: CONFIG.freeLimits[featureType],
    isUnlimited: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkUsage = useCallback(async () => {
    if (!user?.id) {
      // Not logged in - use default free limits
      setUsageData({
        canUse: true,
        currentUsage: 0,
        limit: CONFIG.freeLimits[featureType],
        isUnlimited: false,
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await backendService.checkCanUse(user.id, featureType);
      
      if (result.success && result.data) {
        setUsageData(result.data);
      } else {
        setError(result.error || 'Failed to check usage');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to check usage');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, featureType]);

  useEffect(() => {
    checkUsage();
  }, [checkUsage]);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      setError('Please sign in to use this feature');
      return false;
    }

    // Check if user can use
    if (!usageData.isUnlimited && !usageData.canUse) {
      return false;
    }

    try {
      const result = await backendService.incrementUsage(user.id, featureType);
      
      if (result.success) {
        // Refresh usage data
        await checkUsage();
        return true;
      } else {
        setError(result.error || 'Failed to increment usage');
        return false;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to increment usage');
      return false;
    }
  }, [user?.id, featureType, usageData, checkUsage]);

  return {
    canUse: usageData.canUse,
    currentUsage: usageData.currentUsage,
    limit: usageData.limit,
    isUnlimited: usageData.isUnlimited,
    isLoading,
    error,
    incrementUsage,
    refreshUsage: checkUsage,
  };
}

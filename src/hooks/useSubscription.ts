import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { backendService } from '@/services/backend';
import type { Subscription, PlanTier } from '@/types/subscription';
import { SUBSCRIPTION_CONFIG as CONFIG, PLAN_TIERS } from '@/types/subscription';

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
  initiatePayment: (planTier?: PlanTier) => Promise<string | null>;
  verifyPayment: (transactionId: string) => Promise<boolean>;
  refreshSubscription: () => Promise<void>;
  subscriptionConfig: typeof CONFIG;
  planTiers: typeof PLAN_TIERS;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await backendService.getSubscription(user.id);
      
      if (result.success) {
        setSubscription(result.data || null);
      } else {
        setError(result.error || 'Failed to fetch subscription');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const initiatePayment = useCallback(async (planTier: PlanTier = 'quarterly'): Promise<string | null> => {
    if (!user?.id || !user?.email) {
      setError('Please sign in to subscribe');
      return null;
    }

    try {
      setError(null);
      const result = await backendService.initiatePayment(user.id, user.email, planTier);
      
      if (result.success && result.data) {
        return result.data.paymentLink;
      } else {
        setError(result.error || 'Failed to initiate payment');
        return null;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
      return null;
    }
  }, [user?.id, user?.email]);

  const verifyPayment = useCallback(async (transactionId: string): Promise<boolean> => {
    try {
      setError(null);
      const result = await backendService.verifyPayment(transactionId);
      
      if (result.success) {
        await fetchSubscription();
        return true;
      } else {
        setError(result.error || 'Payment verification failed');
        return false;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment verification failed');
      return false;
    }
  }, [fetchSubscription]);

  const isPremium = !!subscription && 
    subscription.status === 'active' && 
    (!subscription.expiresAt || subscription.expiresAt > new Date());

  return {
    subscription,
    isPremium,
    isLoading,
    error,
    initiatePayment,
    verifyPayment,
    refreshSubscription: fetchSubscription,
    subscriptionConfig: CONFIG,
    planTiers: PLAN_TIERS,
  };
}

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { backendService } from '@/services/backend';
import type { PlanTier } from '@/types/subscription';

interface UseFlutterwaveInlineReturn {
  isLoading: boolean;
  error: string | null;
  initiateInlinePayment: (planTier?: PlanTier) => Promise<void>;
}

type FlutterwaveCheckoutConfig = Record<string, unknown>;

// Declare the Flutterwave global
declare global {
  interface Window {
    FlutterwaveCheckout: (config: FlutterwaveCheckoutConfig) => void;
  }
}

export function useFlutterwaveInline(_onSuccess: () => void): UseFlutterwaveInlineReturn {
  const { user, session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Flutterwave inline script
  useEffect(() => {
    if (document.getElementById('flutterwave-inline-script')) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'flutterwave-inline-script';
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError('Failed to load payment script');
    document.body.appendChild(script);
  }, []);

  const initiateInlinePayment = useCallback(async (planTier: PlanTier = 'quarterly') => {
    if (!user || !session) {
      setError('Please sign in to subscribe');
      return;
    }

    if (!scriptLoaded) {
      setError('Payment system is loading, please try again');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the active backend service to initiate payment
      const result = await backendService.initiatePayment(user.id, user.email!, planTier);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to initiate payment');
      }

      // Redirect to Flutterwave payment page
      window.location.href = result.data.paymentLink;
    } catch (err: unknown) {
      console.error('Payment initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      setIsLoading(false);
    }
  }, [user, session, scriptLoaded]);

  return {
    isLoading,
    error,
    initiateInlinePayment,
  };
}

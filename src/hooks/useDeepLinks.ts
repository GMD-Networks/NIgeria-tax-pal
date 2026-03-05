import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { toast } from 'sonner';

export function useDeepLinks() {
  const navigate = useNavigate();
  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Handle deep link when app is opened from a link
    const handleAppUrlOpen = (event: URLOpenListenerEvent) => {
      console.log('Deep link received:', event.url);
      
      // Show loading state for payment callbacks
      const isPaymentCallback = event.url.includes('subscription') && 
        (event.url.includes('status=') || event.url.includes('transaction_id=') || event.url.includes('tx_ref='));
      
      if (isPaymentCallback) {
        setIsProcessingDeepLink(true);
        toast.loading('Processing payment...', { id: 'payment-processing' });
      }
      
      // Parse the URL - expected format: app.lovable.f2e79429168148e7a29d0211f841ed6d://subscription?status=...
      try {
        const url = new URL(event.url);
        const path = url.pathname || url.host; // pathname might be empty for custom schemes
        const search = url.search;
        
        // Navigate to the path with query params
        if (path === 'subscription' || path === '/subscription') {
          navigate(`/subscription${search}`);
        } else if (path) {
          navigate(`/${path}${search}`);
        }
      } catch (error) {
        console.error('Error parsing deep link:', error);
        // Fallback: try to extract path manually
        const urlParts = event.url.split('://');
        if (urlParts.length > 1) {
          const pathWithParams = urlParts[1];
          if (pathWithParams.startsWith('subscription')) {
            navigate(`/${pathWithParams}`);
          }
        }
      } finally {
        // Dismiss toast after navigation (the subscription page will handle its own loading)
        setTimeout(() => {
          toast.dismiss('payment-processing');
          setIsProcessingDeepLink(false);
        }, 500);
      }
    };

    // Add listener
    App.addListener('appUrlOpen', handleAppUrlOpen);

    // Cleanup
    return () => {
      App.removeAllListeners();
    };
  }, [navigate]);

  return { isProcessingDeepLink };
}

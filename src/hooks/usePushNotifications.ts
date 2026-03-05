import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { useAuth } from './useAuth';

export interface PushNotificationState {
  token: string | null;
  isRegistered: boolean;
  isSupported: boolean;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    token: null,
    isRegistered: false,
    isSupported: Capacitor.isNativePlatform(),
  });

  // Save push token to database
  const savePushToken = useCallback(async (token: string) => {
    if (!user) return;
    
    try {
      const platform = Capacitor.getPlatform();
      const payload: Record<string, unknown> = {
        user_id: user.id,
        push_token: token,
        platform,
        updated_at: new Date().toISOString(),
      };
      
      // Upsert the token
      const { error } = await backendApi
        .from('user_push_tokens')
        .upsert(payload, {
          onConflict: 'user_id,push_token'
        });

      if (error) {
        console.error('Error saving push token:', error);
      } else {
        console.log('Push token saved successfully');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not supported on web');
      return;
    }

    const registerPushNotifications = async () => {
      try {
        // Check current permission status
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('Push notification permission not granted');
          return;
        }

        // Register for push notifications
        await PushNotifications.register();
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    };

    // Listen for registration success
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setState(prev => ({
        ...prev,
        token: token.value,
        isRegistered: true,
      }));
      
      // Save token to database
      await savePushToken(token.value);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error: unknown) => {
      console.error('Push registration error:', error);
      setState(prev => ({
        ...prev,
        isRegistered: false,
      }));
    });

    // Listen for incoming notifications when app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      toast(notification.title || 'Notification', {
        description: notification.body,
      });
    });

    // Listen for notification taps
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push notification action performed:', notification);
      // Handle notification tap - navigate to relevant page based on notification data
      const data = notification.notification.data;
      if (data?.type === 'tax_update') {
        window.location.href = '/learn';
      } else if (data?.type === 'consultant_reply') {
        window.location.href = '/chat';
      } else if (data?.type === 'subscription_reminder') {
        window.location.href = '/subscription';
      }
    });

    registerPushNotifications();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [savePushToken]);

  // Re-save token when user changes
  useEffect(() => {
    if (user && state.token) {
      savePushToken(state.token);
    }
  }, [user, state.token, savePushToken]);

  const requestPermission = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error('Push notifications are only available on mobile devices');
      return false;
    }

    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting push permission:', error);
      return false;
    }
  };

  return {
    ...state,
    requestPermission,
  };
}

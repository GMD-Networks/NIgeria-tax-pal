// cPanel PHP Backend implementation
// Handles subscriptions, usage tracking, and payments via PHP API

import type { IBackendService } from './types';
import type {
  FeatureType,
  FeatureUsage,
  Subscription,
  UsageCheckResult,
  ApiResponse,
  PlanTier,
} from '@/types/subscription';

const API_BASE_URL = import.meta.env.VITE_CPANEL_API_URL || 'https://taxpal.reddonisha.com/api';

function getStoredToken(): string | null {
  return localStorage.getItem('auth_token');
}

export class CpanelPhpService implements IBackendService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const token = getStoredToken();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data: data.data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Request failed';
      return { success: false, error: message };
    }
  }

  async getUsage(userId: string, featureType: FeatureType): Promise<ApiResponse<FeatureUsage | null>> {
    return this.request<FeatureUsage | null>(`/usage/${userId}/${featureType}`);
  }

  async incrementUsage(userId: string, featureType: FeatureType): Promise<ApiResponse<FeatureUsage>> {
    return this.request<FeatureUsage>(`/usage/${userId}/${featureType}/increment`, {
      method: 'POST',
    });
  }

  async checkCanUse(userId: string, featureType: FeatureType): Promise<ApiResponse<UsageCheckResult>> {
    return this.request<UsageCheckResult>(`/usage/${userId}/${featureType}/check`);
  }

  async getSubscription(userId: string): Promise<ApiResponse<Subscription | null>> {
    return this.request<Subscription | null>(`/subscriptions/${userId}`);
  }

  async hasActiveSubscription(userId: string): Promise<ApiResponse<boolean>> {
    const result = await this.getSubscription(userId);
    return {
      success: result.success,
      data: !!result.data && result.data.status === 'active',
      error: result.error,
    };
  }

  async createSubscription(userId: string, transactionRef: string, planTier?: PlanTier): Promise<ApiResponse<Subscription>> {
    return this.request<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ userId, transactionRef, planTier: planTier || 'quarterly' }),
    });
  }

  async initiatePayment(userId: string, email: string, planTier?: PlanTier): Promise<ApiResponse<{ paymentLink: string; transactionRef: string }>> {
    return this.request<{ paymentLink: string; transactionRef: string }>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({ userId, email, planTier: planTier || 'quarterly' }),
    });
  }

  async verifyPayment(transactionId: string): Promise<ApiResponse<Subscription>> {
    return this.request<Subscription>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
  }
}

export const cpanelPhpService = new CpanelPhpService();

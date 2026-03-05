// Backend service interface - implement this for different backends
import type {
  FeatureType,
  FeatureUsage,
  Subscription,
  UsageCheckResult,
  ApiResponse,
  PlanTier,
} from '@/types/subscription';

export interface IBackendService {
  // Usage tracking
  getUsage(userId: string, featureType: FeatureType): Promise<ApiResponse<FeatureUsage | null>>;
  incrementUsage(userId: string, featureType: FeatureType): Promise<ApiResponse<FeatureUsage>>;
  checkCanUse(userId: string, featureType: FeatureType): Promise<ApiResponse<UsageCheckResult>>;
  
  // Subscription management
  getSubscription(userId: string): Promise<ApiResponse<Subscription | null>>;
  hasActiveSubscription(userId: string): Promise<ApiResponse<boolean>>;
  createSubscription(userId: string, transactionRef: string, planTier?: PlanTier): Promise<ApiResponse<Subscription>>;
  
  // Payment
  initiatePayment(userId: string, email: string, planTier?: PlanTier): Promise<ApiResponse<{ paymentLink: string; transactionRef: string }>>;
  verifyPayment(transactionId: string): Promise<ApiResponse<Subscription>>;
}

export type BackendType = 'cpanel-php';

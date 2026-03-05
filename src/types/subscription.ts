// Backend-agnostic types for subscription and usage tracking
// These interfaces can work with Lovable Cloud OR a custom cPanel PHP backend

export type FeatureType = 'calculator' | 'invoice' | 'chat';

export type SubscriptionPlan = 'free' | 'premium';

export type SubscriptionStatus = 'active' | 'expired' | 'pending' | 'cancelled';

// Plan tier types
export type PlanTier = 'quarterly' | 'biannual' | 'annual';

export interface PlanDetails {
  id: PlanTier;
  name: string;
  price: number;
  duration: number; // in months
  durationLabel: string;
  savings?: string;
  popular?: boolean;
}

export interface FeatureUsage {
  id: string;
  userId: string;
  featureType: FeatureType;
  usageCount: number;
  monthYear: string; // Format: YYYY-MM
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  planType: SubscriptionPlan;
  planTier?: PlanTier;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  transactionRef?: string;
  transactionId?: string;
  startsAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageLimits {
  calculator: number;
  invoice: number;
  chat: number;
}

export interface SubscriptionConfig {
  freeLimits: UsageLimits;
  premiumLimits: UsageLimits;
  plans: PlanDetails[];
  currency: string;
}

// Pricing tiers
export const PLAN_TIERS: PlanDetails[] = [
  {
    id: 'quarterly',
    name: '3 Months',
    price: 999,
    duration: 3,
    durationLabel: '3 months',
  },
  {
    id: 'biannual',
    name: '6 Months',
    price: 1499,
    duration: 6,
    durationLabel: '6 months',
    savings: 'Save ₦499',
    popular: true,
  },
  {
    id: 'annual',
    name: '1 Year',
    price: 2499,
    duration: 12,
    durationLabel: '1 year',
    savings: 'Save ₦1,489',
  },
];

// Default configuration
export const SUBSCRIPTION_CONFIG: SubscriptionConfig = {
  freeLimits: {
    calculator: 5,
    invoice: 5,
    chat: 5,
  },
  premiumLimits: {
    calculator: -1, // unlimited
    invoice: -1,
    chat: -1,
  },
  plans: PLAN_TIERS,
  currency: 'NGN',
};

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UsageCheckResult {
  canUse: boolean;
  currentUsage: number;
  limit: number;
  isUnlimited: boolean;
}

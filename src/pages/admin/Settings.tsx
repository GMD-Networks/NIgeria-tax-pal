import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as backendApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Mail, Server, Lock, Send, Eye, EyeOff, CreditCard, Key, Palette, Bell, Building, Bot, Newspaper, Crown, Plus, Trash2, Check, X, Wrench } from 'lucide-react';
import TaxContentFeed from '@/components/admin/TaxContentFeed';
import { Badge } from '@/components/ui/badge';
import { ALL_TOOLS, DEFAULT_TOOL_CONFIG, type ToolConfig } from '@/hooks/useToolAvailability';
import { Checkbox } from '@/components/ui/checkbox';

interface SMTPSettings {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  encryption: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  duration: number;
  durationLabel: string;
  savings?: string;
  popular?: boolean;
  features: string[];
}

interface SubscriptionPlanConfig {
  tiers: SubscriptionTier[];
  free_limits: {
    calculator: number;
    invoice: number;
    chat: number;
    scanner: number;
  };
  currency: string;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

const DEFAULT_SUB_CONFIG: SubscriptionPlanConfig = {
  tiers: [
    { id: 'quarterly', name: '3 Months', price: 999, duration: 3, durationLabel: '3 months', features: ['Unlimited Tax Calculations', 'Unlimited Invoices', 'Unlimited AI Chat', 'Unlimited Document Scans'] },
    { id: 'biannual', name: '6 Months', price: 1499, duration: 6, durationLabel: '6 months', savings: 'Save ₦499', popular: true, features: ['Unlimited Tax Calculations', 'Unlimited Invoices', 'Unlimited AI Chat', 'Unlimited Document Scans'] },
    { id: 'annual', name: '1 Year', price: 2499, duration: 12, durationLabel: '1 year', savings: 'Save ₦1,489', features: ['Unlimited Tax Calculations', 'Unlimited Invoices', 'Unlimited AI Chat', 'Unlimited Document Scans'] },
  ],
  free_limits: { calculator: 5, invoice: 5, chat: 5, scanner: 5 },
  currency: 'NGN',
};

// Helper function to fetch config by type
const fetchConfig = async (configType: string) => {
  const { data: session } = await backendApi.auth.getSession();
  if (!session?.session?.access_token) return null;
  
  const { data, error } = await backendApi.functions.invoke(`manage-api-config?type=${encodeURIComponent(configType)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
  });
  
  if (error) throw error;
  return data?.config_data || null;
};

// Helper function to save config by type
const saveConfig = async (configType: string, configData: unknown) => {
  const { data: session } = await backendApi.auth.getSession();
  if (!session?.session?.access_token) {
    throw new Error('You must be logged in to update settings');
  }
  
  const { data, error } = await backendApi.functions.invoke('manage-api-config', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: {
      type: configType,
      config_data: configData,
      is_active: true,
    },
  });
  
  if (error) throw error;
  return data;
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showFlutterwaveSecret, setShowFlutterwaveSecret] = useState(false);
  
  // SMTP Form State
  const [smtpFormData, setSmtpFormData] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: 'TaxBot',
    encryption: 'tls',
    is_active: true,
  });
  
  // Flutterwave Form State
  const [flutterwaveFormData, setFlutterwaveFormData] = useState({
    public_key: '',
    secret_key: '',
  });
  const [isSavingFlutterwave, setIsSavingFlutterwave] = useState(false);
  
  // AI Configuration Form State
  const [aiFormData, setAiFormData] = useState({
    provider: 'gemini' as 'gemini' | 'deepseek',
    api_key: '',
    model: 'google/gemini-3-flash-preview',
    max_tokens: 4096,
    ocr_provider: 'auto' as 'auto' | 'gemini' | 'deepseek',
    ocr_api_key: '',
    ocr_model: '',
  });
  const [showAIKey, setShowAIKey] = useState(false);
  const [isSavingAI, setIsSavingAI] = useState(false);
  
  // App Branding Form State
  const [brandingFormData, setBrandingFormData] = useState({
    app_name: 'TaxBot',
    tagline: 'Your Smart Nigerian Tax Assistant',
    primary_color: '#008751',
    logo_url: '',
    support_email: '',
    support_phone: '',
    website_url: '',
    footer_text: '',
    accent_color: '#e8a838',
    font_family: 'Plus Jakarta Sans',
    border_radius: '0.75rem',
  });
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  
  // Notification Preferences Form State
  const [notificationFormData, setNotificationFormData] = useState({
    enable_push_notifications: true,
    enable_email_notifications: true,
    welcome_email_enabled: true,
    subscription_reminder_enabled: true,
    subscription_reminder_days: 3,
    tax_update_notifications: true,
    consultant_reply_notifications: true,
    marketing_emails_enabled: false,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Subscription Plan State
  const [subConfig, setSubConfig] = useState<SubscriptionPlanConfig>(DEFAULT_SUB_CONFIG);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [newFeature, setNewFeature] = useState('');
  
  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Tool Availability State
  const [toolConfig, setToolConfig] = useState<ToolConfig>(DEFAULT_TOOL_CONFIG);
  const [isSavingTools, setIsSavingTools] = useState(false);

  // Fetch Flutterwave Settings
  const { data: flutterwaveSettings, isLoading: isLoadingFlutterwave } = useQuery({
    queryKey: ['config-flutterwave'],
    queryFn: () => fetchConfig('flutterwave'),
  });

  // Fetch Branding Settings
  const { data: brandingSettings, isLoading: isLoadingBranding } = useQuery({
    queryKey: ['config-branding'],
    queryFn: () => fetchConfig('branding'),
  });

  // Fetch AI Settings
  const { data: aiSettings, isLoading: isLoadingAI } = useQuery({
    queryKey: ['config-ai'],
    queryFn: () => fetchConfig('ai'),
  });

  // Fetch Notification Settings
  const { data: notificationSettings, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['config-notifications'],
    queryFn: () => fetchConfig('notifications'),
  });

  // Fetch Subscription Settings
  const { data: subscriptionSettings, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['config-subscription'],
    queryFn: () => fetchConfig('subscription'),
  });

  // Fetch Tool Availability Settings
  const { data: toolAvailabilitySettings, isLoading: isLoadingToolAvailability } = useQuery({
    queryKey: ['config-tool-availability'],
    queryFn: () => fetchConfig('tool_availability'),
  });

  useEffect(() => {
    if (flutterwaveSettings) {
      setFlutterwaveFormData({
        public_key: flutterwaveSettings.public_key || '',
        secret_key: flutterwaveSettings.secret_key || '',
      });
    }
  }, [flutterwaveSettings]);

  useEffect(() => {
    if (brandingSettings) {
      setBrandingFormData(prev => ({
        ...prev,
        ...brandingSettings,
      }));
    }
  }, [brandingSettings]);

  useEffect(() => {
    if (aiSettings) {
      const normalizedAiSettings = (aiSettings as { config_data?: unknown; [key: string]: unknown }).config_data && typeof (aiSettings as { config_data?: unknown }).config_data === 'object'
        ? (aiSettings as { config_data: Record<string, unknown> }).config_data
        : (aiSettings as Record<string, unknown>);

      setAiFormData(prev => ({
        ...prev,
        ...normalizedAiSettings,
      }));
    }
  }, [aiSettings]);

  useEffect(() => {
    if (notificationSettings) {
      setNotificationFormData(prev => ({
        ...prev,
        ...notificationSettings,
      }));
    }
  }, [notificationSettings]);

  useEffect(() => {
    if (subscriptionSettings) {
      setSubConfig(prev => ({
        ...prev,
        ...subscriptionSettings,
      }));
    }
  }, [subscriptionSettings]);

  useEffect(() => {
    if (toolAvailabilitySettings) {
      setToolConfig(prev => ({
        ...prev,
        ...toolAvailabilitySettings,
      }));
    }
  }, [toolAvailabilitySettings]);
  const { data: smtpSettings, isLoading: isLoadingSMTP } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: async () => {
      const { data, error } = await backendApi
        .from('smtp_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as SMTPSettings | null;
    },
  });

  useEffect(() => {
    if (smtpSettings) {
      setSmtpFormData({
        host: smtpSettings.host,
        port: smtpSettings.port,
        username: smtpSettings.username,
        password: smtpSettings.password,
        from_email: smtpSettings.from_email,
        from_name: smtpSettings.from_name,
        encryption: smtpSettings.encryption,
        is_active: smtpSettings.is_active,
      });
    }
  }, [smtpSettings]);

  // SMTP Save Mutation
  const saveSMTPMutation = useMutation({
    mutationFn: async (data: typeof smtpFormData) => {
      if (smtpSettings?.id) {
        const { error } = await backendApi
          .from('smtp_settings')
          .update(data)
          .eq('id', smtpSettings.id);
        if (error) throw error;
      } else {
        const { error } = await backendApi
          .from('smtp_settings')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] });
      toast.success('SMTP settings saved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleSMTPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSMTPMutation.mutate(smtpFormData);
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await backendApi.functions.invoke('send-smtp-email', {
        body: {
          to: testEmail,
          subject: 'TaxBot SMTP Test',
          html: '<h1>SMTP Configuration Test</h1><p>If you received this email, your SMTP settings are configured correctly!</p>',
        },
      });

      if (error) throw error;
      toast.success('Test email sent successfully!');
    } catch (error: unknown) {
      toast.error(`Failed to send test email: ${getErrorMessage(error)}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Flutterwave handlers
  const handleFlutterwaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFlutterwave(true);
    
    try {
      await saveConfig('flutterwave', flutterwaveFormData);
      queryClient.invalidateQueries({ queryKey: ['config-flutterwave'] });
      toast.success('Flutterwave API keys saved successfully');
    } catch (error: unknown) {
      toast.error(`Failed to save Flutterwave keys: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingFlutterwave(false);
    }
  };

  // AI Configuration handlers
  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAI(true);
    
    try {
      const trimmedKey = aiFormData.api_key.trim();
      if (!trimmedKey) {
        toast.error('Please enter a valid AI API key');
        return;
      }

      const normalizedProvider = aiFormData.provider === 'deepseek' ? 'deepseek' : 'gemini';
      const apiUrl = normalizedProvider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const normalizedOcrProvider = aiFormData.ocr_provider === 'auto'
        ? 'auto'
        : (aiFormData.ocr_provider === 'deepseek' ? 'deepseek' : 'gemini');
      const ocrApiUrl = normalizedOcrProvider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : normalizedOcrProvider === 'gemini'
          ? 'https://openrouter.ai/api/v1/chat/completions'
          : '';

      await saveConfig('ai', {
        ...aiFormData,
        provider: normalizedProvider,
        api_key: trimmedKey,
        api_url: apiUrl,
        ocr_provider: normalizedOcrProvider,
        ocr_api_url: ocrApiUrl,
        ocr_api_key: aiFormData.ocr_api_key.trim(),
        ocr_model: aiFormData.ocr_model.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['config-ai'] });
      toast.success('AI configuration saved successfully');
    } catch (error: unknown) {
      toast.error(`Failed to save AI settings: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingAI(false);
    }
  };

  // Branding handlers
  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBranding(true);
    
    try {
      await saveConfig('branding', brandingFormData);
      queryClient.invalidateQueries({ queryKey: ['config-branding'] });
      queryClient.invalidateQueries({ queryKey: ['public-branding'] });
      toast.success('Branding settings saved successfully');
    } catch (error: unknown) {
      toast.error(`Failed to save branding settings: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingBranding(false);
    }
  };

  // Notification handlers
  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotifications(true);
    
    try {
      await saveConfig('notifications', notificationFormData);
      queryClient.invalidateQueries({ queryKey: ['config-notifications'] });
      toast.success('Notification preferences saved successfully');
    } catch (error: unknown) {
      toast.error(`Failed to save notification preferences: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Subscription handlers
  const handleSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSubscription(true);
    try {
      await saveConfig('subscription', subConfig);
      queryClient.invalidateQueries({ queryKey: ['config-subscription'] });
      toast.success('Subscription plans saved successfully');
    } catch (error: unknown) {
      toast.error(`Failed to save subscription plans: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingSubscription(false);
    }
  };

  const updateTier = (index: number, field: keyof SubscriptionTier, value: SubscriptionTier[keyof SubscriptionTier]) => {
    setSubConfig(prev => {
      const tiers = [...prev.tiers];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...prev, tiers };
    });
  };

  const addTier = () => {
    setSubConfig(prev => ({
      ...prev,
      tiers: [...prev.tiers, {
        id: `tier_${Date.now()}`,
        name: 'New Plan',
        price: 0,
        duration: 1,
        durationLabel: '1 month',
        features: ['Unlimited Tax Calculations'],
      }],
    }));
  };

  const removeTier = (index: number) => {
    setSubConfig(prev => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  };

  const addFeatureToTier = (tierIndex: number) => {
    if (!newFeature.trim()) return;
    setSubConfig(prev => {
      const tiers = [...prev.tiers];
      tiers[tierIndex] = { ...tiers[tierIndex], features: [...tiers[tierIndex].features, newFeature.trim()] };
      return { ...prev, tiers };
    });
    setNewFeature('');
  };

  const removeFeatureFromTier = (tierIndex: number, featureIndex: number) => {
    setSubConfig(prev => {
      const tiers = [...prev.tiers];
      tiers[tierIndex] = { ...tiers[tierIndex], features: tiers[tierIndex].features.filter((_, i) => i !== featureIndex) };
      return { ...prev, tiers };
    });
  };

  // Tool Availability handlers
  const handleToolToggle = (toolKey: string, checked: boolean) => {
    setToolConfig(prev => ({ ...prev, [toolKey]: checked }));
  };

  const handleToolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTools(true);
    try {
      await saveConfig('tool_availability', toolConfig);
      queryClient.invalidateQueries({ queryKey: ['config-tool-availability'] });
      queryClient.invalidateQueries({ queryKey: ['public-tool-config'] });
      toast.success('Tool availability settings saved successfully');
    } catch (error: unknown) {
      toast.error(`Failed to save tool settings: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingTools(false);
    }
  };

  const enableAllTools = () => {
    const allEnabled = Object.keys(ALL_TOOLS).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as ToolConfig);
    setToolConfig(allEnabled);
  };

  const disableAllTools = () => {
    const allDisabled = Object.keys(ALL_TOOLS).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as ToolConfig);
    setToolConfig(allDisabled);
  };

  if (isLoadingSMTP) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your application configuration and integrations.</p>
      </div>

      <Tabs defaultValue="smtp" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 max-w-5xl">
          <TabsTrigger value="smtp" className="flex items-center gap-1">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">SMTP</span>
          </TabsTrigger>
          <TabsTrigger value="flutterwave" className="flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-1">
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Plans</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-1">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Tools</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">AI</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="content-feed" className="flex items-center gap-1">
            <Newspaper className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Content</span>
          </TabsTrigger>
        </TabsList>

        {/* SMTP Tab */}
        <TabsContent value="smtp" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Server Configuration
                </CardTitle>
                <CardDescription>
                  Enter your SMTP server details. You can get these from your email provider.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSMTPSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">SMTP Host</Label>
                    <Input id="host" placeholder="smtp.example.com" value={smtpFormData.host} onChange={(e) => setSmtpFormData({ ...smtpFormData, host: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input id="port" type="number" placeholder="587" value={smtpFormData.port} onChange={(e) => setSmtpFormData({ ...smtpFormData, port: parseInt(e.target.value) || 587 })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="encryption">Encryption</Label>
                      <Select value={smtpFormData.encryption} onValueChange={(value) => setSmtpFormData({ ...smtpFormData, encryption: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tls">TLS</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" placeholder="your@email.com" value={smtpFormData.username} onChange={(e) => setSmtpFormData({ ...smtpFormData, username: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={smtpFormData.password} onChange={(e) => setSmtpFormData({ ...smtpFormData, password: e.target.value })} required />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                      <Switch id="is_active" checked={smtpFormData.is_active} onCheckedChange={(checked) => setSmtpFormData({ ...smtpFormData, is_active: checked })} />
                      <Label htmlFor="is_active">Enable SMTP</Label>
                    </div>
                    <Button type="submit" disabled={saveSMTPMutation.isPending}>
                      {saveSMTPMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Settings'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Sender Information</CardTitle>
                  <CardDescription>Configure how your emails will appear to recipients.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_name">From Name</Label>
                    <Input id="from_name" placeholder="TaxBot" value={smtpFormData.from_name} onChange={(e) => setSmtpFormData({ ...smtpFormData, from_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from_email">From Email</Label>
                    <Input id="from_email" type="email" placeholder="noreply@yourdomain.com" value={smtpFormData.from_email} onChange={(e) => setSmtpFormData({ ...smtpFormData, from_email: e.target.value })} required />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" />Test Configuration</CardTitle>
                  <CardDescription>Send a test email to verify your SMTP settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test_email">Test Email Address</Label>
                    <Input id="test_email" type="email" placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                  </div>
                  <Button onClick={handleTestEmail} disabled={isTesting || !smtpSettings} variant="outline" className="w-full">
                    {isTesting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Test Email</>}
                  </Button>
                  {!smtpSettings && <p className="text-sm text-muted-foreground text-center">Save your SMTP settings first before testing.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Flutterwave Tab */}
        <TabsContent value="flutterwave" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" />API Keys Configuration</CardTitle>
                <CardDescription>Configure your Flutterwave API keys for payment processing.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFlutterwaveSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="flw_public_key">Public Key</Label>
                    <Input id="flw_public_key" placeholder="FLWPUBK-xxxxxxxxxxxx" value={flutterwaveFormData.public_key} onChange={(e) => setFlutterwaveFormData({ ...flutterwaveFormData, public_key: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flw_secret_key">Secret Key</Label>
                    <div className="relative">
                      <Input id="flw_secret_key" type={showFlutterwaveSecret ? 'text' : 'password'} placeholder="FLWSECK-xxxxxxxxxxxx" value={flutterwaveFormData.secret_key} onChange={(e) => setFlutterwaveFormData({ ...flutterwaveFormData, secret_key: e.target.value })} />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowFlutterwaveSecret(!showFlutterwaveSecret)}>
                        {showFlutterwaveSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button type="submit" className="w-full" disabled={isSavingFlutterwave}>
                      {isSavingFlutterwave ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Update API Keys'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Current Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingFlutterwave ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Public Key</span>
                      <span className={`text-sm ${flutterwaveSettings?.public_key ? 'text-primary' : 'text-muted-foreground'}`}>
                        {flutterwaveSettings?.public_key ? 'Configured ✓' : 'Not configured'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Secret Key</span>
                      <span className={`text-sm ${flutterwaveSettings?.secret_key ? 'text-primary' : 'text-muted-foreground'}`}>
                        {flutterwaveSettings?.secret_key ? 'Configured ✓' : 'Not configured'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Subscription Plans Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <form onSubmit={handleSubscriptionSubmit}>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Free tier limits */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Free Tier Limits</CardTitle>
                  <CardDescription>Set monthly usage limits for free users.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Tax Calculations</Label>
                      <Input type="number" min={0} value={subConfig.free_limits.calculator} onChange={(e) => setSubConfig(prev => ({ ...prev, free_limits: { ...prev.free_limits, calculator: parseInt(e.target.value) || 0 } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoices</Label>
                      <Input type="number" min={0} value={subConfig.free_limits.invoice} onChange={(e) => setSubConfig(prev => ({ ...prev, free_limits: { ...prev.free_limits, invoice: parseInt(e.target.value) || 0 } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>AI Chat Messages</Label>
                      <Input type="number" min={0} value={subConfig.free_limits.chat} onChange={(e) => setSubConfig(prev => ({ ...prev, free_limits: { ...prev.free_limits, chat: parseInt(e.target.value) || 0 } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Document Scans</Label>
                      <Input type="number" min={0} value={subConfig.free_limits.scanner} onChange={(e) => setSubConfig(prev => ({ ...prev, free_limits: { ...prev.free_limits, scanner: parseInt(e.target.value) || 0 } }))} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription tiers */}
              {subConfig.tiers.map((tier, index) => (
                <Card key={tier.id} className={tier.popular ? 'border-primary ring-2 ring-primary/20' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Crown className="w-4 h-4 text-primary" />
                        Plan {index + 1}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {tier.popular && <Badge variant="default" className="text-xs">Popular</Badge>}
                        {subConfig.tiers.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTier(index)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Plan Name</Label>
                      <Input value={tier.name} onChange={(e) => updateTier(index, 'name', e.target.value)} placeholder="e.g. 3 Months" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Price (₦)</Label>
                        <Input type="number" min={0} value={tier.price} onChange={(e) => updateTier(index, 'price', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Duration (months)</Label>
                        <Input type="number" min={1} value={tier.duration} onChange={(e) => updateTier(index, 'duration', parseInt(e.target.value) || 1)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duration Label</Label>
                      <Input value={tier.durationLabel} onChange={(e) => updateTier(index, 'durationLabel', e.target.value)} placeholder="e.g. 3 months" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Savings Text</Label>
                      <Input value={tier.savings || ''} onChange={(e) => updateTier(index, 'savings', e.target.value)} placeholder="e.g. Save ₦499" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={tier.popular || false} onCheckedChange={(checked) => updateTier(index, 'popular', checked)} />
                      <Label className="text-xs">Mark as Popular</Label>
                    </div>
                    
                    {/* Features */}
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-semibold">Included Features</Label>
                      <div className="space-y-1">
                        {tier.features.map((feature, fi) => (
                          <div key={fi} className="flex items-center gap-2 text-sm">
                            <Check className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="flex-1 text-xs">{feature}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFeatureFromTier(index, fi)}>
                              <X className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input className="h-7 text-xs" placeholder="Add feature..." value={newFeature} onChange={(e) => setNewFeature(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeatureToTier(index); } }} />
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => addFeatureToTier(index)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex items-center gap-3 mt-4">
              <Button type="button" variant="outline" onClick={addTier} className="gap-2">
                <Plus className="w-4 h-4" /> Add Plan Tier
              </Button>
              <Button type="submit" disabled={isSavingSubscription}>
                {isSavingSubscription ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Subscription Plans'}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* AI Configuration Tab */}
        <TabsContent value="ai" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5" />AI Configuration</CardTitle>
                <CardDescription>Configure AI settings for tax assistance. Gemini (via OpenRouter) and DeepSeek both require an API key.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAISubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>AI Provider</Label>
                    <Select value={aiFormData.provider} onValueChange={(value: 'gemini' | 'deepseek') => {
                      const defaultModel = value === 'gemini' ? 'google/gemini-3-flash-preview' : 'deepseek-chat';
                      setAiFormData({ ...aiFormData, provider: value, model: defaultModel });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Google Gemini (Recommended)</SelectItem>
                        <SelectItem value="deepseek">DeepSeek AI</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {aiFormData.provider === 'gemini' 
                        ? 'Gemini uses OpenRouter in this deployment. Enter your OpenRouter API key.' 
                        : 'DeepSeek requires your own API key from platform.deepseek.com.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai_api_key">{aiFormData.provider === 'deepseek' ? 'DeepSeek API Key' : 'OpenRouter API Key'}</Label>
                    <div className="relative">
                      <Input id="ai_api_key" type={showAIKey ? 'text' : 'password'} placeholder="sk-or-v1-xxxxxxxxxxxx" value={aiFormData.api_key} onChange={(e) => setAiFormData({ ...aiFormData, api_key: e.target.value })} />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowAIKey(!showAIKey)}>
                        {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai_model">Model</Label>
                    <Select value={aiFormData.model} onValueChange={(value) => setAiFormData({ ...aiFormData, model: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {aiFormData.provider === 'gemini' ? (
                          <>
                            <SelectItem value="google/gemini-3-flash-preview">Gemini 3 Flash (Fast & Balanced)</SelectItem>
                            <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Good Balance)</SelectItem>
                            <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</SelectItem>
                            <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (Most Capable)</SelectItem>
                            <SelectItem value="google/gemini-3-pro-preview">Gemini 3 Pro (Next-Gen)</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                            <SelectItem value="deepseek-coder">DeepSeek Coder</SelectItem>
                            <SelectItem value="deepseek-reasoner">DeepSeek Reasoner</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai_max_tokens">Max Tokens</Label>
                    <Input id="ai_max_tokens" type="number" min={256} max={32768} value={aiFormData.max_tokens} onChange={(e) => setAiFormData({ ...aiFormData, max_tokens: parseInt(e.target.value) || 4096 })} />
                  </div>

                  <div className="pt-2 border-t border-border/60" />

                  <div className="space-y-2">
                    <Label>Scanner/OCR Provider (Optional Override)</Label>
                    <Select value={aiFormData.ocr_provider} onValueChange={(value: 'auto' | 'gemini' | 'deepseek') => setAiFormData({ ...aiFormData, ocr_provider: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Use Main AI Settings</SelectItem>
                        <SelectItem value="gemini">Gemini/OpenRouter (Vision model required)</SelectItem>
                        <SelectItem value="deepseek">DeepSeek (Vision-capable model required)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Set only if you want scanner to use a different model/key than chat/content.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ocr_api_key">Scanner/OCR API Key (Optional)</Label>
                    <Input id="ocr_api_key" type="password" placeholder="Leave blank to reuse main AI key" value={aiFormData.ocr_api_key} onChange={(e) => setAiFormData({ ...aiFormData, ocr_api_key: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ocr_model">Scanner/OCR Model (Optional)</Label>
                    <Input id="ocr_model" placeholder="Example: google/gemini-2.5-flash or other vision-capable model" value={aiFormData.ocr_model} onChange={(e) => setAiFormData({ ...aiFormData, ocr_model: e.target.value })} />
                  </div>

                  <div className="pt-4">
                    <Button type="submit" className="w-full" disabled={isSavingAI}>
                      {isSavingAI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save AI Configuration'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" />Current Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingAI ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Provider</span>
                      <span className="text-sm text-muted-foreground">{aiSettings?.provider === 'deepseek' ? 'DeepSeek AI' : 'Google Gemini'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">API Key</span>
                      <span className={`text-sm ${aiSettings?.api_key ? 'text-primary' : 'text-destructive'}`}>
                        {aiSettings?.api_key ? 'Configured ✓' : 'Not configured'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Model</span>
                      <span className="text-sm text-muted-foreground">{aiSettings?.model || 'google/gemini-3-flash-preview'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Max Tokens</span>
                      <span className="text-sm text-muted-foreground">{aiSettings?.max_tokens || 4096}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">OCR Provider</span>
                      <span className="text-sm text-muted-foreground">{aiSettings?.ocr_provider && aiSettings?.ocr_provider !== 'auto' ? aiSettings?.ocr_provider : 'Main AI Settings'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">OCR Model</span>
                      <span className="text-sm text-muted-foreground">{aiSettings?.ocr_model || 'Not set'}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5" />App Identity</CardTitle>
                <CardDescription>Configure your app's name, tagline, and visual identity. Changes apply immediately to the frontend.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBrandingSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app_name">Application Name</Label>
                    <Input id="app_name" placeholder="TaxBot" value={brandingFormData.app_name} onChange={(e) => setBrandingFormData({ ...brandingFormData, app_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input id="tagline" placeholder="Your Smart Nigerian Tax Assistant" value={brandingFormData.tagline} onChange={(e) => setBrandingFormData({ ...brandingFormData, tagline: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input id="primary_color" type="color" className="w-16 h-10 p-1 cursor-pointer" value={brandingFormData.primary_color} onChange={(e) => setBrandingFormData({ ...brandingFormData, primary_color: e.target.value })} />
                      <Input placeholder="#008751" value={brandingFormData.primary_color} onChange={(e) => setBrandingFormData({ ...brandingFormData, primary_color: e.target.value })} className="flex-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Primary brand color used in buttons, links, and headers</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accent_color">Accent Color</Label>
                    <div className="flex gap-2">
                      <Input id="accent_color" type="color" className="w-16 h-10 p-1 cursor-pointer" value={brandingFormData.accent_color} onChange={(e) => setBrandingFormData({ ...brandingFormData, accent_color: e.target.value })} />
                      <Input placeholder="#e8a838" value={brandingFormData.accent_color} onChange={(e) => setBrandingFormData({ ...brandingFormData, accent_color: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input id="logo_url" type="url" placeholder="https://example.com/logo.png" value={brandingFormData.logo_url} onChange={(e) => setBrandingFormData({ ...brandingFormData, logo_url: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font_family">Font Family</Label>
                    <Select value={brandingFormData.font_family} onValueChange={(value) => setBrandingFormData({ ...brandingFormData, font_family: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                        <SelectItem value="Work Sans">Work Sans</SelectItem>
                        <SelectItem value="DM Sans">DM Sans</SelectItem>
                        <SelectItem value="Inter">Inter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="border_radius">Border Radius</Label>
                    <Select value={brandingFormData.border_radius} onValueChange={(value) => setBrandingFormData({ ...brandingFormData, border_radius: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0rem">Sharp (0)</SelectItem>
                        <SelectItem value="0.375rem">Subtle (0.375rem)</SelectItem>
                        <SelectItem value="0.5rem">Medium (0.5rem)</SelectItem>
                        <SelectItem value="0.75rem">Rounded (0.75rem)</SelectItem>
                        <SelectItem value="1rem">Large (1rem)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-4">
                    <Button type="submit" className="w-full" disabled={isSavingBranding}>
                      {isSavingBranding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save & Apply Branding'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Contact Information</CardTitle>
                  <CardDescription>Support and contact details shown to users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="support_email">Support Email</Label>
                    <Input id="support_email" type="email" placeholder="support@example.com" value={brandingFormData.support_email} onChange={(e) => setBrandingFormData({ ...brandingFormData, support_email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support_phone">Support Phone</Label>
                    <Input id="support_phone" placeholder="+234 800 000 0000" value={brandingFormData.support_phone} onChange={(e) => setBrandingFormData({ ...brandingFormData, support_phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website_url">Website URL</Label>
                    <Input id="website_url" type="url" placeholder="https://example.com" value={brandingFormData.website_url} onChange={(e) => setBrandingFormData({ ...brandingFormData, website_url: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="footer_text">Footer Text</Label>
                    <Textarea id="footer_text" placeholder="© 2024 TaxBot. All rights reserved." value={brandingFormData.footer_text} onChange={(e) => setBrandingFormData({ ...brandingFormData, footer_text: e.target.value })} rows={2} />
                  </div>
                </CardContent>
              </Card>

              {isLoadingBranding ? (
                <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" />Live Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="flex items-center gap-3">
                        {brandingFormData.logo_url ? (
                          <img src={brandingFormData.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandingFormData.primary_color }}>
                            {brandingFormData.app_name?.charAt(0) || 'T'}
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold" style={{ fontFamily: brandingFormData.font_family }}>{brandingFormData.app_name || 'TaxBot'}</h3>
                          <p className="text-xs text-muted-foreground">{brandingFormData.tagline || 'Your Smart Nigerian Tax Assistant'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 px-4 flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: brandingFormData.primary_color, borderRadius: brandingFormData.border_radius }}>Primary Button</div>
                        <div className="h-8 px-4 flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: brandingFormData.accent_color, borderRadius: brandingFormData.border_radius }}>Accent</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />Notification Channels</CardTitle>
                <CardDescription>Configure which notification channels are enabled.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNotificationSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5"><Label>Push Notifications</Label><p className="text-xs text-muted-foreground">Enable mobile push notifications</p></div>
                      <Switch checked={notificationFormData.enable_push_notifications} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, enable_push_notifications: checked })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5"><Label>Email Notifications</Label><p className="text-xs text-muted-foreground">Enable email notifications</p></div>
                      <Switch checked={notificationFormData.enable_email_notifications} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, enable_email_notifications: checked })} />
                    </div>
                  </div>
                  <div className="border-t pt-6 space-y-4">
                    <h4 className="font-medium">Email Types</h4>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5"><Label>Welcome Email</Label><p className="text-xs text-muted-foreground">Send welcome email to new users</p></div>
                      <Switch checked={notificationFormData.welcome_email_enabled} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, welcome_email_enabled: checked })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5"><Label>Marketing Emails</Label><p className="text-xs text-muted-foreground">Send promotional and marketing emails</p></div>
                      <Switch checked={notificationFormData.marketing_emails_enabled} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, marketing_emails_enabled: checked })} />
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button type="submit" className="w-full" disabled={isSavingNotifications}>
                      {isSavingNotifications ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Preferences'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Subscription Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5"><Label>Subscription Reminders</Label><p className="text-xs text-muted-foreground">Remind users before subscription expires</p></div>
                    <Switch checked={notificationFormData.subscription_reminder_enabled} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, subscription_reminder_enabled: checked })} />
                  </div>
                  {notificationFormData.subscription_reminder_enabled && (
                    <div className="space-y-2">
                      <Label>Reminder Days Before Expiry</Label>
                      <Select value={String(notificationFormData.subscription_reminder_days)} onValueChange={(value) => setNotificationFormData({ ...notificationFormData, subscription_reminder_days: parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="5">5 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />Activity Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingNotifications ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5"><Label>Tax Updates</Label><p className="text-xs text-muted-foreground">Notify users of new tax content</p></div>
                        <Switch checked={notificationFormData.tax_update_notifications} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, tax_update_notifications: checked })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5"><Label>Consultant Replies</Label><p className="text-xs text-muted-foreground">Notify users when consultants reply</p></div>
                        <Switch checked={notificationFormData.consultant_reply_notifications} onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, consultant_reply_notifications: checked })} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tools Availability Tab */}
        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Tool Availability
              </CardTitle>
              <CardDescription>
                Enable or disable tools for your users. Disabled tools will be hidden from the Tax Tools page and inaccessible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleToolSubmit} className="space-y-6">
                <div className="flex gap-2 mb-4">
                  <Button type="button" variant="outline" size="sm" onClick={enableAllTools}>
                    <Check className="w-3 h-3 mr-1" /> Enable All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={disableAllTools}>
                    <X className="w-3 h-3 mr-1" /> Disable All
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(ALL_TOOLS).map(([key, label]) => {
                    const isEnabled = toolConfig[key] !== false;
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-lg border ${isEnabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`tool-${key}`}
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToolToggle(key, !!checked)}
                          />
                          <div>
                            <Label htmlFor={`tool-${key}`} className="cursor-pointer font-medium text-sm">
                              {label}
                            </Label>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleToolToggle(key, checked)}
                        />
                      </div>
                    );
                  })}
                </div>

                <Button type="submit" disabled={isSavingTools} className="w-full">
                  {isSavingTools ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Tool Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Content Feed Tab */}
        <TabsContent value="content-feed" className="space-y-6">
          <TaxContentFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}

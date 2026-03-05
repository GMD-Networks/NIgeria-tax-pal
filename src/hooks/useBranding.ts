import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api as backendApi } from '@/services/api';

interface BrandingConfig {
  app_name: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  support_email: string;
  support_phone: string;
  website_url: string;
  footer_text: string;
  font_family: string;
  border_radius: string;
}

interface BrandingConfigRow {
  config_data: Record<string, unknown>;
}

const DEFAULT_BRANDING: BrandingConfig = {
  app_name: 'TaxPal',
  tagline: 'Your Smart Nigerian Tax Assistant',
  primary_color: '#008751',
  accent_color: '#e8a838',
  logo_url: '',
  support_email: '',
  support_phone: '',
  website_url: '',
  footer_text: '',
  font_family: 'Plus Jakarta Sans',
  border_radius: '0.75rem',
};

function hexToHSL(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useBranding() {
  const { data: branding, isLoading } = useQuery({
    queryKey: ['public-branding'],
    queryFn: async () => {
      const { data, error } = await backendApi
        .from('api_configurations')
        .select('config_data')
        .eq('config_type', 'branding')
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return DEFAULT_BRANDING;
      
      const config = (data as BrandingConfigRow).config_data;
      return {
        ...DEFAULT_BRANDING,
        ...config,
      } as BrandingConfig;
    },
    staleTime: 5 * 60 * 1000,
  });

  const currentBranding = branding || DEFAULT_BRANDING;

  // Apply branding to CSS variables dynamically
  useEffect(() => {
    const root = document.documentElement;
    
    if (currentBranding.primary_color && currentBranding.primary_color !== DEFAULT_BRANDING.primary_color) {
      const hsl = hexToHSL(currentBranding.primary_color);
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
    }

    if (currentBranding.border_radius && currentBranding.border_radius !== DEFAULT_BRANDING.border_radius) {
      root.style.setProperty('--radius', currentBranding.border_radius);
    }

    if (currentBranding.font_family && currentBranding.font_family !== DEFAULT_BRANDING.font_family) {
      document.body.style.fontFamily = `'${currentBranding.font_family}', sans-serif`;
    }

    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--radius');
      document.body.style.fontFamily = '';
    };
  }, [currentBranding.primary_color, currentBranding.border_radius, currentBranding.font_family]);

  return {
    branding: currentBranding,
    isLoading,
  };
}

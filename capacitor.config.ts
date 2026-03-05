import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f2e79429168148e7a29d0211f841ed6d',
  appName: 'Nigeria Tax Companion',
  webDir: 'dist',
  // Remove the server.url for production APK - this makes the app use local bundled files
  // Uncomment the server block below ONLY for live reload during development
  // server: {
  //   url: 'https://f2e79429-1681-48e7-a29d-0211f841ed6d.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#008751',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  },
  // Enable deep linking for payment callbacks
  android: {
    allowMixedContent: true
  }
};

export default config;

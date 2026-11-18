import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xiujixiang.order',
  appName: '食麦呼',
  webDir: 'dist',
  server: {
    url: 'https://39.96.195.158',
    cleartext: false,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;

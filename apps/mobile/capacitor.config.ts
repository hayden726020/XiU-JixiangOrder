import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xiujixiang.order',
  appName: '时麦呼',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;

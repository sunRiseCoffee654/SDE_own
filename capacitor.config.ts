import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.sdeorbit.app',
  appName: 'SDE Orbit',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_icon_config_sample', iconColor: '#3563E9' },
    StatusBar: { style: 'LIGHT', backgroundColor: '#F6F8FC' },
  },
};

export default config;

import { Capacitor, registerPlugin } from '@capacitor/core';

export type OrbitWidgetPayload = {
  taskTitle: string;
  taskDetail: string;
  taskCount: number;
  focusTopic: string;
  focusTime: string;
  streak: number;
};

type WidgetAction = { tab?: 'tasks' | 'focus' };

const OrbitWidget = registerPlugin<{
  syncState(payload: OrbitWidgetPayload): Promise<void>;
  consumeAction(): Promise<WidgetAction>;
}>('OrbitWidget');

export async function syncWidgets(payload: OrbitWidgetPayload) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await OrbitWidget.syncState(payload);
  } catch (error) {
    console.warn('Widget update failed', error);
  }
}

export async function consumeWidgetAction(): Promise<WidgetAction> {
  if (!Capacitor.isNativePlatform()) return {};
  try {
    return await OrbitWidget.consumeAction();
  } catch (error) {
    console.warn('Widget action read failed', error);
    return {};
  }
}

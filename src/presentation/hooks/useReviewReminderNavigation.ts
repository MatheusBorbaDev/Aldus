import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

/** Só rotas internas conhecidas: o conteúdo da notificação nunca escolhe um destino arbitrário. */
const ALLOWED = new Set(["/study"]);
export const reminderRoute = (data: unknown): string | null => {
  const url = (data as { url?: unknown } | null)?.url;
  return typeof url === "string" && ALLOWED.has(url) ? url : null;
};

/** Tocar no lembrete de revisão abre o Estudo (app aberto ou iniciado pela notificação). Onda C2. */
export function useReviewReminderNavigation() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    const open = (response: Notifications.NotificationResponse | null) => {
      const route = response ? reminderRoute(response.notification.request.content.data) : null;
      if (active && route) router.push(route as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => { active = false; subscription.remove(); };
  }, []);
}

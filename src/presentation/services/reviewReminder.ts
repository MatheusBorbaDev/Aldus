import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Lembrete diário de revisão (onda C2): notificação local, agendada no aparelho, sem servidor nem push. O texto é genérico porque no
 * horário do disparo o app não sabe quantos flashcards estão vencidos (nenhum número inventado). Não existe na Web.
 */
export const REVIEW_REMINDER_KEY = "@kindle/review-reminder.v1";
export const REVIEW_REMINDER_HOURS = [8, 12, 19, 21] as const;
const CHANNEL = "review-reminder";

export interface ReviewReminder { enabled: boolean; hour: number; notificationId: string | null }
export const DEFAULT_REVIEW_REMINDER: ReviewReminder = { enabled: false, hour: 19, notificationId: null };
export const reviewRemindersSupported = () => Platform.OS !== "web";

export async function readReviewReminder(): Promise<ReviewReminder> {
  const raw = await AsyncStorage.getItem(REVIEW_REMINDER_KEY);
  if (!raw) return DEFAULT_REVIEW_REMINDER;
  const value = JSON.parse(raw);
  const hour = REVIEW_REMINDER_HOURS.includes(value?.hour) ? value.hour : DEFAULT_REVIEW_REMINDER.hour;
  return { enabled: value?.enabled === true, hour, notificationId: typeof value?.notificationId === "string" ? value.notificationId : null };
}

/** Resultado explícito: o chamador mostra a mensagem certa (permissão negada é diferente de falha). */
export type ReminderResult = { ok: true; reminder: ReviewReminder } | { ok: false; reason: "denied" | "unsupported" | "failed" };

/**
 * Liga (em `hour`) ou desliga. Cancela sempre o agendamento anterior conhecido antes de criar outro, para nunca haver dois.
 * Só grava a preferência depois que o agendamento deu certo.
 */
export async function setReviewReminder(enabled: boolean, hour: number, previous: ReviewReminder): Promise<ReminderResult> {
  if (!reviewRemindersSupported()) return { ok: false, reason: "unsupported" };
  try {
    if (previous.notificationId) await Notifications.cancelScheduledNotificationAsync(previous.notificationId);
    if (!enabled) {
      const reminder = { enabled: false, hour, notificationId: null };
      await AsyncStorage.setItem(REVIEW_REMINDER_KEY, JSON.stringify(reminder));
      return { ok: true, reminder };
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return { ok: false, reason: "denied" };
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Lembrete de revisão", importance: Notifications.AndroidImportance.DEFAULT });
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: "Hora de revisar", body: "Seus flashcards esperam uma revisão no Aldus.", data: { url: "/study" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL },
    });
    const reminder = { enabled: true, hour, notificationId };
    await AsyncStorage.setItem(REVIEW_REMINDER_KEY, JSON.stringify(reminder));
    return { ok: true, reminder };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

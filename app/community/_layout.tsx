import { Stack } from "expo-router";
import { CommunityProvider } from "@/src/community/presentation/CommunityProvider";

export default function CommunityLayout() {
  return <CommunityProvider><Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" /><Stack.Screen name="profile" />
    <Stack.Screen name="edit-profile" /><Stack.Screen name="people" />
    <Stack.Screen name="reader/[username]" /><Stack.Screen name="clubs" /><Stack.Screen name="club/[id]" />
    <Stack.Screen name="forums" /><Stack.Screen name="thread/[id]" /><Stack.Screen name="[section]" />
  </Stack></CommunityProvider>;
}

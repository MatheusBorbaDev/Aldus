import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** "Remover animações"/reduzir movimento do sistema; começa em false e acompanha mudanças enquanto a tela está aberta. */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo?.isReduceMotionEnabled?.().then(value => { if (active) setReduced(value === true); }).catch(() => undefined);
    const subscription = AccessibilityInfo?.addEventListener?.("reduceMotionChanged", value => setReduced(value === true));
    return () => { active = false; subscription?.remove?.(); };
  }, []);
  return reduced;
}

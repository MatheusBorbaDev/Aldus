import { useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { FormFactor, formFactorFor } from "./formFactor";

const FINE_POINTER = "(pointer: fine)";

function finePointerNow(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(FINE_POINTER).matches;
}

/** Layout do app nesta janela; muda junto com a largura e com o ponteiro (ex.: tablet com teclado e mouse). */
export function useFormFactor(): FormFactor {
  const { width } = useWindowDimensions();
  const [finePointer, setFinePointer] = useState(finePointerNow);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(FINE_POINTER);
    const update = () => setFinePointer(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return formFactorFor({ web: Platform.OS === "web", width, finePointer });
}

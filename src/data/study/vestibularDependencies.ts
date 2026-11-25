import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/src/data/remote/supabase";
import { VestibularReadingsService, VestibularRemote } from "./VestibularReadingsService";

function supabaseRemote(): VestibularRemote | null {
  const client = supabase;
  if (!client) return null;
  const rows = async (query: PromiseLike<{ data: unknown; error: unknown }>) => { const { data, error } = await query; if (error) throw error; return data; };
  return {
    readVestibulares: () => rows(client.from("vestibulares").select("id,name,institution,official_url,sort").order("sort").order("id")),
    readLists: () => rows(client.from("vestibular_reading_lists").select("vestibular_id,exam_year,source_url,books").order("exam_year", { ascending: false }).limit(500)),
    suggest: (vestibularId, message) => rows(client.rpc("vestibular_suggest", { p_vestibular: vestibularId, p_message: message })),
  };
}

export const vestibularReadings = new VestibularReadingsService(supabaseRemote(), AsyncStorage);

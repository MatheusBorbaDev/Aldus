import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createAccountDeleteHandler } from "./handler.ts";

Deno.serve(createAccountDeleteHandler(createClient, (name) => Deno.env.get(name)));

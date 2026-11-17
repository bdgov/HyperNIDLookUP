// public/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zerpoynznygpuimngxwl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z4MOXEs3Igne2BbnB9CDNg_jGaiZZbE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import { createClient } from '@supabase/supabase-js';

// Como o código vai rodar na web (Next) ou no mobile (Expo), 
// precisamos garantir que ele pegue a variável de ambiente correta de cada ambiente.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('As variáveis de ambiente do Supabase estão faltando!');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export * from './types';
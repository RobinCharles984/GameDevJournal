'use client';

import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@repo/database'; // <-- Voltamos ao cliente original
import GameDesignMap from './GameDesignMap';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  // Removemos o const supabase = createClient(); daqui

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Se não estiver logado, mostra o formulário bonito do Supabase
  if (!session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f4f4f5' }}>
        <div style={{ width: '400px', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ textAlign: 'center', color: '#175e7a', marginBottom: '20px' }}>Game Design Journal</h2>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google', 'apple']} // Seus provedores sociais
            theme="light"
          />
        </div>
      </div>
    );
  }

  // Se estiver logado, mostra o mapa mental passando o ID do usuário de verdade!
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GameDesignMap userId={session.user.id} supabase={supabase} />
    </div>
  );
}
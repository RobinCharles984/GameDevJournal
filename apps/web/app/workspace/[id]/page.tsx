'use client';

// Adicionamos o 'use' na importação do React
import { useEffect, useState, use } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabase';
import GameDesignMap from '../../GameDesignMap'; // Ajuste o caminho conforme necessário

// Atualizamos a tipagem para receber uma Promise
export default function WorkspacePage(props: { params: Promise<{ id: string }> }) {
  // Desempacota o ID usando o novo padrão do Next.js 16
  const params = use(props.params); 
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
      } else {
        setUserId(session.user.id);
      }
    }
    
    checkUser();
  }, [router]);

  if (!userId) {
    return (
      <div style={{ background: '#121212', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        Carregando workspace...
      </div>
    );
  }

  return (
    <GameDesignMap 
      userId={userId} 
      projectId={params.id} // Agora o params.id está desempacotado corretamente!
      supabase={supabase} 
    />
  );
}
'use client';

// Adicionamos o 'use' na importação do React
import { useEffect, useState, use } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabase';
import dynamic from 'next/dynamic';

// Isso força o Next.js a rodar o seu Workspace APENAS no navegador do usuário
const GameDesignMap = dynamic(() => import('../../GameDesignMap'), { 
  ssr: false,
  loading: () => <div style={{ color: '#a855f7', padding: '20px' }}>Carregando Engine Visual...</div>
});

export default function WorkspacePage(props: { params: Promise<{ id: string }> }) {
  const { t } = useTranslation();
  // Desempacota o ID usando o novo padrão do Next.js 16
  const params = use(props.params); 
  
  const [userId, setUserId] = useState<string | null>(null);
  // NOVO: Guarda se o usuário pode 'edit' (editar) ou apenas 'read' (ler)
  const [accessLevel, setAccessLevel] = useState<'edit' | 'read' | null>(null); 
  
  const router = useRouter();

  useEffect(() => {
    async function checkAccess() {
      // 1. Verifica se tem sessão logada
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Se não tem login, manda pro login mas avisa a URL de volta!
        router.push(`/login?redirect=/workspace/${params.id}`);
        return;
      }

      // 2. Busca o projeto no banco para ver as permissões
      const { data: project, error } = await supabase
        .from('projects') // Se a sua tabela tiver outro nome (ex: workspaces), mude aqui!
        .select('user_id, share_mode')
        .eq('id', params.id)
        .single();

      if (error || !project) {
        alert('Projeto não encontrado.');
        router.push('/dashboard');
        return;
      }

      // 3. Regras de Entrada (O Porteiro)
      const isOwner = project.user_id === session.user.id;
      
      if (isOwner) {
        setAccessLevel('edit'); // Dono sempre edita
      } else if (project.share_mode === 'edit') {
        setAccessLevel('edit'); // Visitante com link de edição
      } else if (project.share_mode === 'read') {
        setAccessLevel('read'); // Visitante com link só de leitura
      } else {
        // É privado (share_mode === 'private') e não é o dono
        alert('Você não tem permissão para acessar este projeto.');
        router.push('/dashboard');
        return;
      }

      // Se passou em todos os testes, libera a entrada!
      setUserId(session.user.id);
    }
    
    checkAccess();
  }, [params.id, router]);

  // Se ainda não descobriu o usuário ou o nível de acesso, segura na tela de loading
  if (!userId || !accessLevel) {
    return (
      <div style={{ background: '#121212', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        Verificando credenciais e permissões...
      </div>
    );
  }

  return (
    <GameDesignMap 
      userId={userId} 
      projectId={params.id} 
      supabase={supabase} 
      accessLevel={accessLevel} // PASSA A PERMISSÃO PARA DENTRO DO MAPA
    />
  );
}
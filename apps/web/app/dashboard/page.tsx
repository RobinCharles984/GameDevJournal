'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadProjects() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) console.error('Erro ao carregar projetos:', error);
      if (data) setProjects(data);
    }
    loadProjects();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return alert('Digite um nome para o projeto!');

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return alert('Você precisa estar logado!');

    // Tenta inserir no banco
    const { data, error } = await supabase
      .from('projects')
      .insert([{ title: newProjectName, user_id: session.user.id }])
      .select()
      .single();

    // === TRATAMENTO DE ERRO (Isso resolve o "não acontece nada") ===
    if (error) {
      console.error('Erro completo do Supabase:', error);
      alert(`Erro ao criar: ${error.message}`);
      return;
    }

    if (data) {
      router.push(`/workspace/${data.id}`);
    }
  };

  return (
    <div style={{ padding: '40px', background: '#121212', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
        <h1 style={{ margin: 0 }}>Meus Projetos</h1>
        <button 
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Sair
        </button>
      </div>
      
      <div style={{ marginBottom: '40px', display: 'flex', gap: '12px' }}>
        <input 
          type="text" 
          placeholder="Nome do Novo Projeto" 
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          style={{ padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#1e1e24', color: '#fff', width: '300px' }}
        />
        <button 
          onClick={handleCreateProject}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Criar e Entrar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
        {projects.map(project => (
          <div 
            key={project.id} 
            onClick={() => router.push(`/workspace/${project.id}`)}
            style={{ 
              background: '#1e1e24', padding: '24px', borderRadius: '8px', 
              border: '1px solid #333', cursor: 'pointer', transition: '0.2s' 
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = '#333'}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{project.title}</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Clique para abrir o workspace</p>
          </div>
        ))}
      </div>
    </div>
  );
}
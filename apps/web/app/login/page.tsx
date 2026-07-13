'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase'; // Ajuste o caminho se o seu supabase.ts estiver em outro lugar

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Função para fazer o Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      // Se deu certo, manda pro Dashboard
      router.push('/dashboard');
    }
  };

  // Função rápida para criar uma conta nova direto pela tela
  const handleSignUp = async () => {
    if (!email || !password) return setErrorMsg('Preencha e-mail e senha para criar conta.');
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      alert('Conta criada com sucesso! Agora clique em Entrar.');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: '#121212', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <form 
        onSubmit={handleLogin}
        style={{ background: '#1e1e24', padding: '40px', borderRadius: '8px', border: '1px solid #333', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <h2 style={{ margin: '0 0 16px 0', color: '#fff', textAlign: 'center' }}>GameDev Journal</h2>
        
        {errorMsg && (
          <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', fontSize: '14px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <input 
          type="email" 
          placeholder="Seu E-mail" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '4px', border: '1px solid #333', background: '#121212', color: '#fff', fontSize: '16px' }}
        />
        
        <input 
          type="password" 
          placeholder="Sua Senha" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '4px', border: '1px solid #333', background: '#121212', color: '#fff', fontSize: '16px' }}
        />

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '8px' }}
        >
          {loading ? 'Carregando...' : 'Entrar'}
        </button>

        <button 
          type="button" 
          onClick={handleSignUp}
          disabled={loading}
          style={{ padding: '12px', background: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}
        >
          Criar nova conta
        </button>
      </form>
    </div>
  );
}
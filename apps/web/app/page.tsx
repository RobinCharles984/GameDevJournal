import { redirect } from 'next/navigation';

export default function Home() {
  // Redireciona qualquer acesso da página inicial direto para o Dashboard
  redirect('/dashboard');
}
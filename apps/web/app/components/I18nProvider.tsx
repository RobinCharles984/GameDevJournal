'use client';
import { useEffect, useState } from 'react';
// Importe aquele arquivo i18n que acabamos de criar no Passo 3
import '../i18n'; 

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Segura a tela em branco por milissegundos até ler o idioma

  return <>{children}</>;
}
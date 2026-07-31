import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // Função que inverte o idioma atual
  const toggleLanguage = () => {
    // Verifica se o idioma atual começa com 'pt' (para cobrir pt-BR ou pt-PT)
    const currentLang = i18n.language || 'pt';
    const nextLang = currentLang.startsWith('pt') ? 'en' : 'pt';
    
    i18n.changeLanguage(nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid #3f3f46',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 2s',
      }}
      // Efeito de hover simples via JS (ou você pode usar classes CSS)
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
    >
      {/* Mostra a opção de mudar para o idioma OPOSTO ao atual */}
      {i18n.language?.startsWith('pt') ? (
        <><span>🇺🇸</span> EN</>
      ) : (
        <><span>🇧🇷</span> PT</>
      )}
    </button>
  );
}
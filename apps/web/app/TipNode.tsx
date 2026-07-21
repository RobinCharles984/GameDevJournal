import { useState, useRef, useEffect, memo } from 'react';
import { Handle, Position } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TipNodeProps {
  id: string;
  selected: boolean;
  data: {
    title: string;
    content: string;
    tags?: string[];
    imageUrl?: string; 
    linkUrl?: string;  
    onDelete: (id: string) => void;
    onEdit: (id: string, title: string, content: string, tags: string[], imageUrl: string, linkUrl: string) => void;
    onSaveTemplate: (id: string) => void;
    onToggleExpand?: (id: string, isExpanded: boolean) => void;
  };
}

function TipNode({ id, data, selected }: TipNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) setIsOverflowing(contentRef.current.scrollHeight > 160);
  }, [data.content, data.imageUrl]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (data.onToggleExpand) data.onToggleExpand(id, nextState);
  };

  const handleStyle = { width: '10px', height: '10px', background: '#3b82f6', border: '2px solid #1e1e24', borderRadius: '50%' };

  return (
    <div style={{
      background: '#1e1e24', borderRadius: '8px', 
      border: selected ? '2px solid #eab308' : '2px solid #2a2a35', 
      width: isExpanded ? '450px' : '250px', 
      transform: isExpanded ? 'translate(-100px, -75px)' : 'translate(0px, 0px)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: selected ? '0 0 15px rgba(234, 179, 8, 0.3)' : (isExpanded ? '0 30px 60px rgba(0,0,0,0.8)' : '0 4px 10px rgba(0,0,0,0.3)'),
      color: '#fff', fontFamily: 'sans-serif', position: 'relative'
    }}>
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
      `}</style>
      <Handle type="source" position={Position.Top} id="top" style={{ ...handleStyle, top: '-5px' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, right: '-5px' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...handleStyle, bottom: '-5px' }} />
      <Handle type="source" position={Position.Left} id="left" style={{ ...handleStyle, left: '-5px' }} />
      
      {/* TÍTULO DA TIP COM MARKDOWN INLINE */}
        <div style={{ 
          fontWeight: 'bold', 
          color: '#ffffff', 
          background: '#3b82f6',
          padding: '8px 12px',
          borderRadius: '6px 6px 0 0',
          fontSize: '16px',
          flex: 1 // Garante que ocupe o espaço correto ao lado de possíveis botões
        }}>
          {data.title ? (
            <ReactMarkdown
              components={{
                // O SEGREDO: Transforma o parágrafo padrão em um texto contínuo
                // para não quebrar o alinhamento da barra de título!
                p: ({node, ...props}) => <span {...props} />,
                
                // Formatações permitidas no título
                strong: ({node, ...props}) => <strong style={{ color: '#fbbf24' }} {...props} />, // Negrito fica amarelinho
                em: ({node, ...props}) => <em style={{ fontStyle: 'italic' }} {...props} />,
                code: ({node, ...props}) => (
                  <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px', fontSize: '12px' }} {...props} />
                )
              }}
            >
              {data.title}
            </ReactMarkdown>
          ) : (
            'Nova Ideia'
          )}
        </div>
      
      {/* IMAGEM DE CAPA */}
      {data.imageUrl && data.imageUrl.trim() !== '' && (
        <div style={{ width: '100%', height: isExpanded ? '250px' : '120px', backgroundImage: `url(${data.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid #2a2a35', transition: 'height 0.3s' }} />
      )}

      <div style={{ position: 'relative' }}>
        {/* ÁREA DO CONTEÚDO (Agora com motor Markdown) */}
        <div 
          className="markdown-container custom-scroll" 
          style={{ 
            padding: '12px', 
            fontSize: '14px', 
            color: '#d1d5db',
            maxHeight: '200px', // Opcional: Evita que o cartão fique infinito
            overflowY: 'auto'
          }}
        >
          {data.content ? (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Estiliza os elementos do Markdown para o seu Tema Escuro nativamente
                p: ({node, ...props}) => <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }} {...props} />,
                a: ({node, ...props}) => <a style={{ color: '#3b82f6', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer" {...props} />,
                ul: ({node, ...props}) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
                ol: ({node, ...props}) => <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
                li: ({node, ...props}) => <li style={{ marginBottom: '4px' }} {...props} />,
                strong: ({node, ...props}) => <strong style={{ color: '#fff' }} {...props} />,
                // Estilo lindo para tabelas de RPG / Atributos
                table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }} {...props} />,
                th: ({node, ...props}) => <th style={{ borderBottom: '1px solid #52525b', padding: '4px', textAlign: 'left', color: '#fff' }} {...props} />,
                td: ({node, ...props}) => <td style={{ borderBottom: '1px solid #3f3f46', padding: '4px' }} {...props} />,
              }}
            >
              {data.content}
            </ReactMarkdown>
          ) : (
            <span style={{ fontStyle: 'italic', color: '#52525b' }}>Sem conteúdo...</span>
          )}
          {/* LINK EXTERNO */}
          {data.linkUrl && data.linkUrl.trim() !== '' && (
            <a href={data.linkUrl.startsWith('http') ? data.linkUrl : `https://${data.linkUrl}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', padding: '8px', background: '#2563eb', color: '#fff', textAlign: 'center', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
              🔗 Acessar Link
            </a>
          )}
        </div>

        {isOverflowing && !isExpanded && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, #1e1e24)' }} />
        )}
      </div>

      {data.tags && data.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '0px 12px 12px 12px', background: '#1e1e24' }}>
          {data.tags.map((tag, index) => (
            <span key={index} style={{ background: '#4b5563', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '12px', textTransform: 'uppercase' }}>{tag}</span>
          ))}
        </div>
      )}

      <div className="nodrag" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: '#2a2a35', borderTop: '1px solid #1e1e24', flexWrap: 'wrap', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }}>
        <div style={{ flex: 1 }}>
          {/* CORREÇÃO DO BOTÃO: Agora ele SEMPRE aparece, permitindo expandir a qualquer momento */}
          <button onClick={toggleExpand} style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            {isExpanded ? '↙ Encolher' : '↗ Expandir'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); data.onSaveTemplate(id); }} style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⭐</button>
          <button onClick={(e) => { e.stopPropagation(); data.onEdit(id, data.title, data.content, data.tags || [], data.imageUrl || '', data.linkUrl || ''); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Editar</button>
          <button onClick={(e) => { e.stopPropagation(); data.onDelete(id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

export default memo(TipNode);
import { Handle, Position } from 'reactflow';

interface TipNodeProps {
  id: string;
  data: {
    title: string;
    content: string;
    tags?: string[];
    onDelete: (id: string) => void;
    onEdit: (id: string, title: string, content: string, tags: string[]) => void;
    onSaveTemplate: (id: string) => void;
  };
}

export default function TipNode({ id, data }: TipNodeProps) {
  return (
    <div style={{
      background: '#1e1e24',
      borderRadius: '8px',
      border: '2px solid #2a2a35',
      minWidth: '250px',
      maxWidth: '300px',
      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      {/* Handle Esquerdo */}
      <Handle type="target" position={Position.Left} style={{ width: '12px', height: '12px', background: '#3b82f6', border: '2px solid #1e1e24' }} />

      {/* Cabeçalho */}
      <div style={{ background: '#3b82f6', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderBottom: '2px solid #2a2a35' }}>
        {data.title}
      </div>

      {/* Conteúdo */}
      <div 
        className="nodrag nowheel" // Impede de arrastar o nó ou dar zoom no mapa ao fazer scroll
        style={{ 
          padding: '12px', 
          fontSize: '13px', 
          lineHeight: '1.5', 
          color: '#d1d5db',
          maxHeight: '180px', // Aumenta o espaço visível
          overflowY: 'auto'   // Adiciona a barra de rolagem se passar do tamanho
        }}
      >
        {data.content ? data.content : <em style={{ color: '#6b7280' }}>Sem descrição...</em>}
      </div>

      {/* Área de Tags */}
      {data.tags && data.tags.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '4px', 
          padding: '0px 12px 12px 12px', 
          background: '#1e1e24' 
        }}>
          {data.tags.map((tag, index) => (
            <span key={index} style={{
              background: '#4b5563',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '12px',
              textTransform: 'uppercase'
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="nodrag" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '8px 12px', background: '#2a2a35', borderTop: '1px solid #1e1e24' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); data.onSaveTemplate(id); }}
          style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginRight: 'auto' }}
        >
          ⭐ Template
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); data.onEdit(id, data.title, data.content, data.tags || []); }}
          style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
        >
          Editar
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
        >
          Excluir
        </button>
      </div>

      <Handle type="source" position={Position.Right} style={{ width: '12px', height: '12px', background: '#3b82f6', border: '2px solid #1e1e24' }} />
    </div>
  );
}
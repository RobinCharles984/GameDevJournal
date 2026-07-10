import { Handle, Position } from 'reactflow';

interface TipNodeProps {
  id: string;
  data: {
    title: string;
    content: string;
    onDelete: (id: string) => void;
    onEdit: (id: string, title: string, content: string) => void;
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
      <Handle type="target" position={Position.Left} style={{ width: '12px', height: '12px', background: '#3b82f6', border: '2px solid #1e1e24' }} />

      <div style={{ background: '#3b82f6', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderBottom: '2px solid #2a2a35' }}>
        {data.title}
      </div>

      <div style={{ padding: '12px', fontSize: '13px', lineHeight: '1.5', color: '#d1d5db' }}>
        {data.content ? data.content : <em style={{ color: '#6b7280' }}>Sem descrição...</em>}
      </div>

      {/* === A CLASSE NODRAG VEM PARA CÁ === */}
      <div 
        className="nodrag" 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '8px', 
          padding: '8px 12px', 
          background: '#2a2a35', 
          borderTop: '1px solid #1e1e24' 
        }}
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            data.onEdit(id, data.title, data.content);
          }}
          style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
        >
          Editar
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete(id);
          }}
          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
        >
          Excluir
        </button>
      </div>

      <Handle type="source" position={Position.Right} style={{ width: '12px', height: '12px', background: '#3b82f6', border: '2px solid #1e1e24' }} />
    </div>
  );
}
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase'; // Ajuste o caminho para onde está o seu cliente do Supabase

export default function MultiplayerRoom({ projectId, userName = "Visitante" }: { projectId: string, userName?: string }) {
  const [cursors, setCursors] = useState<{ [key: string]: { x: number, y: number, name: string } }>({});
  
  // Usamos um Ref para não enviar 1000 posições por segundo e travar o servidor
  const lastPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // 1. Cria uma sala de comunicação de rádio (Broadcast) com o ID do seu projeto
    const room = supabase.channel(`project-${projectId}`, {
      config: {
        broadcast: { ack: false }, // ack: false prioriza velocidade máxima (sem exigir recibo de entrega)
      },
    });

    // 2. Ouve o que os outros jogadores estão fazendo
    room
      .on('broadcast', { event: 'cursor-move' }, (payload) => {
        setCursors((prev) => ({
          ...prev,
          [payload.payload.userId]: {
            x: payload.payload.x,
            y: payload.payload.y,
            name: payload.payload.name
          },
        }));
      })
      .subscribe();

    // 3. Captura o SEU mouse e avisa os outros
    const handleMouseMove = (e: MouseEvent) => {
      // Só envia para o servidor se o mouse moveu mais de 10 pixels (Economiza banda)
      if (Math.abs(e.clientX - lastPositionRef.current.x) > 10 || Math.abs(e.clientY - lastPositionRef.current.y) > 10) {
        lastPositionRef.current = { x: e.clientX, y: e.clientY };
        
        room.send({
          type: 'broadcast',
          event: 'cursor-move',
          payload: {
            userId: supabase.auth.getSession().then(res => res.data.session?.user.id || 'visitante'), // Pega o seu ID
            x: e.clientX,
            y: e.clientY,
            name: userName
          },
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Limpeza ao sair do projeto
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      supabase.removeChannel(room);
    };
  }, [projectId, userName]);

  // 4. Renderiza os mouses dos outros na sua tela
  return (
    <>
      {Object.entries(cursors).map(([id, cursor]) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: cursor.x,
            top: cursor.y,
            pointerEvents: 'none', // Impede que o mouse do amigo bloqueie os seus cliques
            zIndex: 99999,
            transition: 'left 0.1s linear, top 0.1s linear', // Deixa o movimento suave
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start'
          }}
        >
          {/* A setinha do mouse */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: '#a855f7' }}>
            <polygon points="3 3 10.5 21 13.5 13.5 21 10.5 3 3"></polygon>
          </svg>
          
          {/* A etiqueta com o nome do jogador */}
          <div style={{
            background: '#a855f7',
            color: '#fff',
            fontSize: '12px',
            padding: '2px 8px',
            borderRadius: '4px',
            marginLeft: '12px',
            marginTop: '-4px',
            fontWeight: 'bold'
          }}>
            {cursor.name}
          </div>
        </div>
      ))}
    </>
  );
}
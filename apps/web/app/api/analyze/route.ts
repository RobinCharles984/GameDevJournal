import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  // Inicializa o cliente da OpenAI puxando a chave do seu .env.local
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  try {
    const body = await req.json();
    const { projectData } = body;

    // Se o mapa vier vazio, barramos aqui mesmo
    if (!projectData) {
      return NextResponse.json({ error: "Nenhum dado recebido." }, { status: 400 });
    }

    const response: any = await openai.chat.completions.create({
      model: "gpt-4o", // Usa o modelo mais rápido e inteligente atual
      messages: [
        {
          role: "system",
          content: `Você é o Agent Charles, um Diretor de Game Design Sênior e Engenheiro de Software. 
          O usuário enviará um JSON representando o fluxo visual de um jogo em desenvolvimento na engine.
          
          Sua missão é atuar como um Code Reviewer de Game Design. Analise os dados e responda em Markdown estruturado:
          
          ### 📈 Pontos Fortes
          (Identifique o que brilha na ideia)
          
          ### ⚠️ Furos e Conflitos
          (Aponte furos de roteiro, mecânicas que se contradizem ou loops de gameplay quebrados)
          
          ### ⚙️ Gargalos Técnicos
          (Analise a viabilidade de desenvolvimento, shaders, complexidade 3D e integração de engine baseada na descrição)
          
          ### 💡 Sugestões de Evolução
          (Dê ideias práticas para expandir a experiência do jogador)
          
          Seja direto, profissional, encorajador e altamente técnico.`
        },
        {
          role: "user",
          content: projectData
        }
      ],
      temperature: 0.7,
      max_tokens: 1500, // Garante que a IA tenha espaço para escrever um bom relatório
    });

    return NextResponse.json({ feedback: response.choices[0].message.content });
    
  } catch (error) {
    console.error("Erro no Agent:", error);
    return NextResponse.json({ error: "Falha ao processar a análise." }, { status: 500 });
  }
}
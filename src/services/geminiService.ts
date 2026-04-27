import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getBarberChatResponse(
  message: string, 
  barbeariaName: string, 
  agendaUrl: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) {
  const systemInstruction = `
    Você é o assistente virtual da barbearia "${barbeariaName}".
    Seu objetivo é ajudar os clientes com dúvidas sobre serviços, horários e localização.
    Você deve ser sempre cordial, profissional e eficiente.
    
    IMPORTANTE: Sempre que o cliente demonstrar interesse em agendar ou perguntar como marcar um horário, forneça este link explicitamente: ${agendaUrl}
    
    Mantenha as respostas curtas e objetivas, focadas em ajudar o cliente a realizar o agendamento.
    Se você não souber uma informação específica sobre preços ou serviços (além do que o cliente já pode ver no site), peça para ele verificar no link de agendamento.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "Desculpe, tive um problema para processar sua mensagem. Tente novamente!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ops! Ocorreu um erro no meu sistema. Por favor, tente novamente em instantes.";
  }
}

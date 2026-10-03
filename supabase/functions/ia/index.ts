// Função "ia" (Supabase Edge Function): repassa os pedidos do sistema para a DeepSeek.
// A chave fica no segredo DEEPSEEK_API_KEY do Supabase — nunca vai para o navegador.
// Só usuários logados no sistema podem usar.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);
  try {
    // Confere se quem chamou está logado no sistema (token da sessão do usuário)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const chavePublica = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica);
    const { data } = token ? await supabase.auth.getUser(token) : { data: null };
    if (!data?.user) return responder({ erro: 'Faça login para usar a IA.' }, 401);

    const chave = Deno.env.get('DEEPSEEK_API_KEY');
    if (!chave) return responder({ erro: 'A chave da IA ainda não foi cadastrada no Supabase (segredo DEEPSEEK_API_KEY).' }, 500);

    const pedido = await req.json();
    const corpo: Record<string, unknown> = {
      model: Deno.env.get('DEEPSEEK_MODEL') || pedido.model || 'deepseek-flash',
      messages: pedido.messages,
      max_tokens: Math.min(Number(pedido.max_tokens) || 8000, 32000),
    };
    if (pedido.tools) corpo.tools = pedido.tools;
    if (pedido.response_format) corpo.response_format = pedido.response_format;
    if (pedido.reasoning_effort) corpo.reasoning_effort = pedido.reasoning_effort;

    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify(corpo),
    });
    const texto = await r.text();
    if (!r.ok) {
      let msg = texto;
      try { msg = JSON.parse(texto).error?.message || texto; } catch { /* texto puro */ }
      return responder({ erro: `A IA respondeu com erro (${r.status}): ${msg}` }, r.status === 429 ? 429 : 502);
    }
    return new Response(texto, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return responder({ erro: 'Falha na função de IA: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});

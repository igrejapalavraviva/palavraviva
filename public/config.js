// Sempre usar conexão segura (cadeado) no domínio da igreja
if (location.protocol === 'http:' && /(^|\.)palavraviva\.live$/.test(location.hostname)) {
  location.replace('https://' + location.host + location.pathname + location.search + location.hash);
}

// Endereço do banco (Supabase) e chave PÚBLICA — feita para ficar no site.
// A segurança vem do login + regras de acesso nas tabelas (RLS).
window.IPV_CONFIG = {
  supabaseUrl: 'https://rvmnyizzfzcfzyemrfya.supabase.co',
  supabaseKey: 'sb_publishable_ScurcaMWxST3tUb7dTik9w_gt2dXmLD',
};

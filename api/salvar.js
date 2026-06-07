// api/salvar.js
// Salva o diagnóstico completo no Google Sheets.
// Cada diagnóstico vira uma linha na planilha.

const { google } = require('googleapis');

// Colunas da planilha (na ordem que serão inseridas)
// A | B       | C       | D    | E          | F              | G       | H
// Data | Nome | Empresa | Fase | Problemas  | Plano de ação  | Commit  | Próximo passo

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  // Valida variáveis de ambiente necessárias
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID,
  } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.error('Variáveis do Google Sheets não configuradas');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  try {
    const { answers, relatorio } = req.body;

    if (!answers || !relatorio) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Autentica com Google
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Formata os dados para inserção
    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    const nomeParts = (answers.nome || '').split(/[—\-]/);
    const nomeCliente = (nomeParts[0] || '').trim();
    const nomeEmpresa = (nomeParts[1] || '').trim();

    const problemas = (relatorio.problemas || [])
      .map(p => `[${p.criticidade.toUpperCase()}] ${p.titulo}: ${p.descricao}`)
      .join(' | ');

    const acoes = (relatorio.acoes || []).join(' | ');

    const linha = [
      agora,
      nomeCliente,
      nomeEmpresa || answers.nicho || '—',
      relatorio.fase || '—',
      answers.funcionarios || '—',
      answers.papel || '—',
      answers.ausencia || '—',
      answers.maior_dor || '—',
      answers.vendas || '—',
      answers.lideranca || '—',
      answers.planejamento || '—',
      answers.pdca || '—',
      answers.objetivo || '—',
      answers.comprometimento !== undefined ? `${answers.comprometimento}/10` : '—',
      relatorio.fase_desc || '—',
      problemas,
      acoes,
      relatorio.comprometimento_obs || '—',
      relatorio.proximo_passo || '—',
    ];

    // Insere nova linha na planilha
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Diagnósticos!A:S',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [linha],
      },
    });

    console.log(`Diagnóstico salvo: ${nomeCliente} — ${nomeEmpresa}`);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Erro ao salvar no Sheets:', error.message);
    return res.status(500).json({
      error: 'Erro ao salvar diagnóstico. Os dados foram gerados mas não salvos.',
    });
  }
};

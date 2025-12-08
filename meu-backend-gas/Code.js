// ====== CONFIGURAÇÕES ======
const SHEET_ID = '15SfnNBDvZNcTFb--krf_Hc6U7Nq_VVylNf7IVNjwIgg';
const SHEET_HORARIOS = 'Horarios';
const SHEET_AGENDAMENTOS = 'Agendamentos';

// ====== ENDPOINTS (API) ======

/**
 * GET:
 *  - ?action=getSlots  -> retorna lista de horários LIVRES em JSON
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getSlots') {
    const slots = getAvailableSlots();
    return ContentService
      .createTextOutput(JSON.stringify(slots))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Resposta padrão pra ação inválida
  return ContentService
    .createTextOutput(JSON.stringify({ error: 'Ação inválida' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST:
 *  - corpo JSON com { rowIndex, nome, observacoes }
 *  - grava na planilha e retorna JSON com mensagem
 */
function doPost(e) {
  try {
    let data = null;
    
    // Tenta obter dados do corpo da requisição (POST body)
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseError) {
        // Se não conseguir fazer parse, tenta usar como string
        const contents = e.postData.contents;
        if (contents && contents.trim().startsWith('{')) {
          data = JSON.parse(contents);
        } else {
          throw new Error('Erro ao fazer parse do JSON: ' + parseError.message + '. Conteúdo recebido: ' + contents.substring(0, 200));
        }
      }
    }
    // Se não encontrou no postData, tenta nos parâmetros
    else if (e && e.parameter) {
      // Tenta construir objeto a partir dos parâmetros
      data = {
        rowIndex: e.parameter.rowIndex ? parseInt(e.parameter.rowIndex) : undefined,
        nome: e.parameter.nome || '',
        observacoes: e.parameter.observacoes || ''
      };
    }

    // Log para debug (remova em produção se necessário)
    console.log('doPost recebeu:', {
      hasPostData: !!(e && e.postData),
      hasContents: !!(e && e.postData && e.postData.contents),
      hasParameter: !!(e && e.parameter),
      data: data
    });

    // Valida se os dados foram obtidos
    if (!data || typeof data !== 'object') {
      throw new Error('Nenhum dado válido recebido. Verifique se o frontend está enviando JSON corretamente.');
    }

    // Valida se os dados obrigatórios estão presentes
    if (data.rowIndex === undefined || data.rowIndex === null) {
      throw new Error('Dados inválidos: rowIndex não encontrado ou inválido. Recebido: ' + JSON.stringify(data));
    }

    if (!data.nome) {
      throw new Error('Dados inválidos: nome é obrigatório. Recebido: ' + JSON.stringify(data));
    }

    // Converte rowIndex para número se necessário
    if (typeof data.rowIndex === 'string') {
      data.rowIndex = parseInt(data.rowIndex);
    }

    // Chama a função de agendamento
    const res = bookSlot(data);

    return ContentService
      .createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Log do erro completo
    console.error('Erro em doPost:', error);
    
    // Retorna erro em formato JSON
    return ContentService
      .createTextOutput(JSON.stringify({
        sucesso: false,
        mensagem: error.message || 'Erro desconhecido',
        erro: error.toString(),
        stack: error.stack
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== LÓGICA DE NEGÓCIO ======

/**
 * Lê a aba Horarios e devolve só horários LIVRES já formatados
 */
function getAvailableSlots() {
  // Força o uso do ID específico, não da planilha vinculada
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Valida se abriu a planilha correta
  const planilhaIdAberta = ss.getId();
  if (planilhaIdAberta !== SHEET_ID) {
    throw new Error('ERRO: Planilha aberta não corresponde ao ID configurado! ' +
      'Esperado: ' + SHEET_ID + ', Mas abriu: ' + planilhaIdAberta);
  }
  
  // Log para debug (pode remover depois)
  console.log('✅ Planilha correta aberta:', {
    idEsperado: SHEET_ID,
    idAberto: planilhaIdAberta,
    nomePlanilha: ss.getName(),
    url: ss.getUrl()
  });
  
  const sheet = ss.getSheetByName(SHEET_HORARIOS);

  if (!sheet) {
    throw new Error('A aba "Horarios" não foi encontrada na planilha.');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  // Linha 2 até a última, colunas A (Data), B (Hora), C (Status)
  const range = sheet.getRange(2, 1, lastRow - 1, 3);
  const values = range.getValues();

  const slots = [];

  values.forEach((row, index) => {
    const dataCell = row[0];
    const horaCell = row[1];
    const status = (row[2] || '').toString().toUpperCase().trim();

    if (status === 'LIVRE') {
      const rowIndex = index + 2;

      const dataObj = new Date(dataCell);

      const dataStr = Utilities.formatDate(
        dataObj,
        'America/Sao_Paulo',
        'dd/MM/yyyy'
      );

      const horaStr = Utilities.formatDate(
        new Date(horaCell),
        'America/Sao_Paulo',
        'HH:mm'
      );

      const diasSemana = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado'
      ];
      const diaSemana = diasSemana[dataObj.getDay()];

      slots.push({
        rowIndex: rowIndex,
        data: dataStr,
        hora: horaStr,
        diaSemana: diaSemana
      });
    }
  });

  return slots;
}

/**
 * Marca horário como OCUPADO e registra na aba Agendamentos
 */
function bookSlot(bookingData) {
  // Validação dos dados de entrada
  if (!bookingData || typeof bookingData !== 'object') {
    throw new Error('Dados de agendamento inválidos: bookingData é undefined ou não é um objeto');
  }

  if (!bookingData.rowIndex && bookingData.rowIndex !== 0) {
    throw new Error('Dados de agendamento inválidos: rowIndex não encontrado');
  }

  if (!bookingData.nome) {
    throw new Error('Dados de agendamento inválidos: nome é obrigatório');
  }

  // Força o uso do ID específico, não da planilha vinculada
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Valida se abriu a planilha correta
  const planilhaIdAberta = ss.getId();
  if (planilhaIdAberta !== SHEET_ID) {
    throw new Error('ERRO: Planilha aberta não corresponde ao ID configurado! ' +
      'Esperado: ' + SHEET_ID + ', Mas abriu: ' + planilhaIdAberta);
  }
  
  // Log para debug (pode remover depois)
  console.log('✅ Planilha correta aberta para agendamento:', {
    idEsperado: SHEET_ID,
    idAberto: planilhaIdAberta,
    nomePlanilha: ss.getName()
  });
  
  const sheetHor = ss.getSheetByName(SHEET_HORARIOS);
  const sheetAg = ss.getSheetByName(SHEET_AGENDAMENTOS);

  const rowIndex = bookingData.rowIndex;
  const nome = bookingData.nome;
  const observacoes = bookingData.observacoes || '';

  const row = sheetHor.getRange(rowIndex, 1, 1, 3).getValues()[0];
  const statusAtual = (row[2] || '').toString().toUpperCase().trim();

  if (statusAtual !== 'LIVRE') {
    throw new Error('Esse horário acabou de ser ocupado. Por favor, escolha outro.');
  }

  // Marca como OCUPADO
  sheetHor.getRange(rowIndex, 3).setValue('OCUPADO');

  const data = row[0];
  const hora = row[1];

  // Formata a hora para HH:mm (sem segundos)
  const horaFormatada = Utilities.formatDate(
    new Date(hora),
    'America/Sao_Paulo',
    'HH:mm'
  );

  // Formata a data para dd/MM/yyyy
  const dataFormatada = Utilities.formatDate(
    new Date(data),
    'America/Sao_Paulo',
    'dd/MM/yyyy'
  );

  // Registra o agendamento
  // Ordem: Timestamp, Data, Hora, Nome, Observacoes
  sheetAg.appendRow([
    new Date(), // Timestamp
    dataFormatada,
    horaFormatada,
    nome,
    observacoes
  ]);

  return {
    sucesso: true,
    mensagem: 'Agendamento realizado com sucesso!',
    data: data,
    hora: hora
  };
}

/**
 * Função de teste para verificar qual planilha está sendo acessada
 * Execute esta função no editor do Google Apps Script para verificar
 */
function testarPlanilha() {
  try {
    console.log('🔍 Testando acesso à planilha...');
    console.log('📋 ID configurado (SHEET_ID):', SHEET_ID);
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const idAberto = ss.getId();
    const nomePlanilha = ss.getName();
    const urlPlanilha = ss.getUrl();
    
    console.log('✅ Planilha aberta com sucesso!');
    console.log('📊 ID da planilha aberta:', idAberto);
    console.log('📝 Nome da planilha:', nomePlanilha);
    console.log('🔗 URL da planilha:', urlPlanilha);
    
    // Verifica se é a planilha correta
    if (idAberto === SHEET_ID) {
      console.log('✅ CORRETO: A planilha aberta corresponde ao ID configurado!');
    } else {
      console.error('❌ ERRO: A planilha aberta NÃO corresponde ao ID configurado!');
      console.error('   Esperado:', SHEET_ID);
      console.error('   Recebido:', idAberto);
    }
    
    // Lista as abas disponíveis
    const abas = ss.getSheets();
    console.log('\n📑 Abas disponíveis na planilha:');
    abas.forEach((aba, index) => {
      console.log(`   ${index + 1}. "${aba.getName()}"`);
    });
    
    // Verifica se as abas esperadas existem
    const sheetHor = ss.getSheetByName(SHEET_HORARIOS);
    const sheetAg = ss.getSheetByName(SHEET_AGENDAMENTOS);
    
    console.log('\n🔍 Verificação de abas:');
    if (sheetHor) {
      console.log(`✅ Aba "${SHEET_HORARIOS}" encontrada!`);
      console.log(`   Linhas: ${sheetHor.getLastRow()}`);
    } else {
      console.error(`❌ Aba "${SHEET_HORARIOS}" NÃO encontrada!`);
    }
    
    if (sheetAg) {
      console.log(`✅ Aba "${SHEET_AGENDAMENTOS}" encontrada!`);
      console.log(`   Linhas: ${sheetAg.getLastRow()}`);
    } else {
      console.error(`❌ Aba "${SHEET_AGENDAMENTOS}" NÃO encontrada!`);
    }
    
    return {
      sucesso: true,
      idConfigurado: SHEET_ID,
      idAberto: idAberto,
      nomePlanilha: nomePlanilha,
      urlPlanilha: urlPlanilha,
      corresponde: idAberto === SHEET_ID,
      abas: abas.map(s => s.getName())
    };
    
  } catch (error) {
    console.error('❌ Erro ao testar planilha:', error);
    return {
      sucesso: false,
      erro: error.toString(),
      mensagem: error.message
    };
  }
}

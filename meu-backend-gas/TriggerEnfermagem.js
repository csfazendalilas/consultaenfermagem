// ====== TRIGGER PARA PLANILHA DO POSTO DE SAÚDE - ENFERMAGEM ======
// Este código deve ser adicionado ao Google Apps Script da planilha do posto
// para funcionar com o sistema de Consulta de Enfermagem
//
// IMPORTANTE: 
// - A palavra-chave é "reserva" (não "reservado")
// - Monitora a COLUNA O (não a F)
// - Usa a COLUNA N para o horário
//
// NÃO INTERFERE com o código do projeto "agendamento" que usa colunas diferentes!

// ID da planilha de agendamentos de enfermagem
const PLANILHA_ENFERMAGEM_ID = '15SfnNBDvZNcTFb--krf_Hc6U7Nq_VVylNf7IVNjwIgg';
const ABA_HORARIOS_ENF = 'Horarios';

// Identificador da equipe na aba do posto (ajuste conforme necessário)
const IDENTIFICADOR_EQUIPE_ENF = '783';

/**
 * IMPORTANTE: Execute esta função UMA VEZ para criar o trigger instalável
 * Vá em Executar > criarTriggerEnfermagem
 * 
 * Este trigger NÃO interfere com o trigger do projeto "agendamento"!
 */
function criarTriggerEnfermagem() {
  // Remove triggers antigos desta função específica
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEditEnfermagem') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Cria novo trigger instalável
  ScriptApp.newTrigger('onEditEnfermagem')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
    
  SpreadsheetApp.getUi().alert(
    'Trigger de Enfermagem criado com sucesso!\n\n' +
    'Agora quando você escrever "reserva" na COLUNA O de uma aba ' + IDENTIFICADOR_EQUIPE_ENF + ', ' +
    'o horário será liberado automaticamente na planilha de Consulta de Enfermagem.\n\n' +
    'Este trigger NÃO interfere com o trigger do agendamento (que usa coluna F).'
  );
}

/**
 * Função chamada pelo trigger instalável (tem permissões para acessar outras planilhas)
 */
function onEditEnfermagem(e) {
  processarEdicaoEnfermagem(e);
}

/**
 * Processa a edição - verifica se é "reserva" na COLUNA O de uma aba da equipe
 * Se adicionar "reserva" -> cria horário LIVRE na planilha de enfermagem
 * Se apagar "reserva" -> remove o horário da planilha de enfermagem
 * 
 * Colunas de Enfermagem:
 * - M (13) = identificador "enf"
 * - N (14) = horário
 * - O (15) = nome ou "reserva"
 * - P (16) = data de nascimento
 * - Q (17) = motivo
 */
function processarEdicaoEnfermagem(e) {
  if (!e || !e.source || !e.range) {
    Logger.log('[ENF] Evento inválido');
    return;
  }
  
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const nomeAba = sheet.getName();
  
  // Verifica se é uma aba da equipe (não modelo)
  if (nomeAba.indexOf(IDENTIFICADOR_EQUIPE_ENF) === -1 || nomeAba.toLowerCase().indexOf('modelo') !== -1) {
    return; // Não é a aba certa, ignora
  }
  
  // Verifica se a edição foi na COLUNA O (coluna 15) - colunas de enfermagem
  if (range.getColumn() !== 15) {
    return; // Não é a coluna O, ignora
  }
  
  // Pega o valor atual e o valor antigo
  const valorAtual = (range.getValue() || '').toString().toLowerCase().trim();
  const valorAntigo = (e.oldValue || '').toString().toLowerCase().trim();
  
  // Pega a linha que foi editada
  const linha = range.getRow();
  
  // Pega o horário da COLUNA N (coluna 14) da mesma linha
  const horarioValor = sheet.getRange(linha, 14).getValue();
  const horarioTexto = sheet.getRange(linha, 14).getDisplayValue();
  const horario = horarioTexto || horarioValor;
  
  // A data pode estar em uma célula mesclada acima (coluna C)
  // Busca a data subindo nas linhas até encontrar
  let dataTexto = '';
  let linhaAtual = linha;
  
  while (linhaAtual >= 1 && !dataTexto) {
    dataTexto = sheet.getRange(linhaAtual, 3).getDisplayValue(); // Coluna C
    if (!dataTexto) {
      linhaAtual--;
    }
  }
  
  // Log para debug
  Logger.log('[ENF] Linha: ' + linha + ' | Coluna O | Valor antigo: "' + valorAntigo + '" | Valor atual: "' + valorAtual + '"');
  Logger.log('[ENF] Data (col C): ' + dataTexto + ' | Horário (col N): ' + horario);
  
  // Verifica se encontrou data e horário
  if (!dataTexto || !horario) {
    Logger.log('[ENF] Data ou horário não encontrados');
    return;
  }
  
  // CASO 1: Escreveu "reserva" na coluna O -> libera horário na planilha de enfermagem
  if (valorAtual === 'reserva' && valorAntigo !== 'reserva') {
    Logger.log('[ENF] Ação: LIBERAR horário na planilha de enfermagem');
    liberarHorarioEnfermagem(dataTexto, horario);
  }
  
  // CASO 2: Apagou "reserva" da coluna O -> remove horário da planilha de enfermagem
  else if (valorAntigo === 'reserva' && valorAtual !== 'reserva') {
    Logger.log('[ENF] Ação: REMOVER horário da planilha de enfermagem');
    removerHorarioEnfermagem(dataTexto, horario);
  }
}

/**
 * Libera (cria como LIVRE) um horário na planilha de enfermagem
 */
function liberarHorarioEnfermagem(data, horario) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ENFERMAGEM_ID);
    const sheet = ss.getSheetByName(ABA_HORARIOS_ENF);
    
    if (!sheet) {
      Logger.log('[ENF] Aba Horarios não encontrada na planilha de enfermagem');
      SpreadsheetApp.getUi().alert('Erro: Aba "Horarios" não encontrada na planilha de Consulta de Enfermagem');
      return;
    }
    
    // Normaliza a data e hora para comparação (remove espaços extras)
    const dataNormalizada = normalizarTextoEnf(data);
    const horaNormalizada = normalizarTextoEnf(horario);
    
    Logger.log('[ENF] Buscando: Data=' + dataNormalizada + ' | Hora=' + horaNormalizada);
    
    // Verifica se o horário já existe na planilha
    const lastRow = sheet.getLastRow();
    let horarioExiste = false;
    
    if (lastRow >= 2) {
      const dados = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
      
      for (let i = 0; i < dados.length; i++) {
        const dataExistente = normalizarTextoEnf(dados[i][0]);
        const horaExistente = normalizarTextoEnf(dados[i][1]);
        
        Logger.log('[ENF] Comparando linha ' + (i+2) + ': ' + dataExistente + ' vs ' + dataNormalizada + ' | ' + horaExistente + ' vs ' + horaNormalizada);
        
        if (dataExistente === dataNormalizada && horaExistente === horaNormalizada) {
          // Horário existe, muda para LIVRE
          sheet.getRange(i + 2, 3).setValue('LIVRE');
          horarioExiste = true;
          Logger.log('[ENF] ✅ Horário ' + horaNormalizada + ' do dia ' + dataNormalizada + ' liberado com sucesso!');
          break;
        }
      }
    }
    
    // Se o horário não existe, cria um novo
    if (!horarioExiste) {
      sheet.appendRow([data, horario, 'LIVRE']);
      Logger.log('[ENF] ✅ Novo horário criado: ' + dataNormalizada + ' ' + horaNormalizada);
    }
    
  } catch (erro) {
    Logger.log('[ENF] ❌ Erro ao liberar horário: ' + erro.message);
    SpreadsheetApp.getUi().alert('Erro ao liberar horário de enfermagem: ' + erro.message);
  }
}

/**
 * Remove um horário da planilha de enfermagem
 */
function removerHorarioEnfermagem(data, horario) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ENFERMAGEM_ID);
    const sheet = ss.getSheetByName(ABA_HORARIOS_ENF);
    
    if (!sheet) {
      Logger.log('[ENF] Aba Horarios não encontrada na planilha de enfermagem');
      return;
    }
    
    // Normaliza a data e hora para comparação
    const dataNormalizada = normalizarTextoEnf(data);
    const horaNormalizada = normalizarTextoEnf(horario);
    
    Logger.log('[ENF] Removendo: Data=' + dataNormalizada + ' | Hora=' + horaNormalizada);
    
    // Busca o horário na planilha
    const lastRow = sheet.getLastRow();
    
    if (lastRow >= 2) {
      const dados = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
      
      for (let i = dados.length - 1; i >= 0; i--) {
        const dataExistente = normalizarTextoEnf(dados[i][0]);
        const horaExistente = normalizarTextoEnf(dados[i][1]);
        
        if (dataExistente === dataNormalizada && horaExistente === horaNormalizada) {
          // Encontrou o horário, remove a linha
          sheet.deleteRow(i + 2);
          Logger.log('[ENF] ✅ Horário ' + horaNormalizada + ' do dia ' + dataNormalizada + ' removido com sucesso!');
          return;
        }
      }
    }
    
    Logger.log('[ENF] Horário não encontrado para remover');
    
  } catch (erro) {
    Logger.log('[ENF] ❌ Erro ao remover horário: ' + erro.message);
  }
}

/**
 * Normaliza texto removendo espaços extras e convertendo para comparação
 */
function normalizarTextoEnf(valor) {
  if (!valor) return '';
  return valor.toString().trim();
}

/**
 * Função de teste - executa manualmente para verificar a conexão
 */
function testarConexaoEnfermagem() {
  try {
    Logger.log('========== TESTE DE CONEXÃO - ENFERMAGEM ==========');
    
    const ss = SpreadsheetApp.openById(PLANILHA_ENFERMAGEM_ID);
    Logger.log('✅ Planilha de enfermagem aberta: ' + ss.getName());
    
    const sheet = ss.getSheetByName(ABA_HORARIOS_ENF);
    if (sheet) {
      Logger.log('✅ Aba "' + ABA_HORARIOS_ENF + '" encontrada');
      Logger.log('   Total de linhas: ' + sheet.getLastRow());
    } else {
      Logger.log('❌ Aba "' + ABA_HORARIOS_ENF + '" NÃO encontrada');
    }
    
    Logger.log('========== FIM DO TESTE ==========');
    
    SpreadsheetApp.getUi().alert(
      'Conexão OK!\n\n' +
      'Planilha: ' + ss.getName() + '\n' +
      'Aba: ' + ABA_HORARIOS_ENF + '\n\n' +
      'Colunas monitoradas:\n' +
      '- Coluna O: "reserva" (gatilho)\n' +
      '- Coluna N: horário\n' +
      '- Coluna C: data'
    );
    
  } catch (erro) {
    Logger.log('❌ ERRO: ' + erro.message);
    SpreadsheetApp.getUi().alert('Erro na conexão: ' + erro.message);
  }
}


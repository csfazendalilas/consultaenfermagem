// ============================================
// CONFIGURAÇÕES
// ============================================
const API_URL = 'https://script.google.com/macros/s/AKfycbxctImh1MzJ8bNIMSTYOMy4DxuLloCSzXDn1z5l1VO5Re55T8ScH7yLl-olWBOMNUVDSg/exec';
const WHATSAPP_DESTINO = '5548920039171';

// Estado global
let slotsGlobais = [];

// ============================================
// PROGRESS STEPS
// ============================================
function atualizarProgressStep(stepAtivo) {
  const steps = document.querySelectorAll('.step');
  const lines = document.querySelectorAll('.step-line');

  steps.forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');

    if (stepNum < stepAtivo) {
      step.classList.add('completed');
    } else if (stepNum === stepAtivo) {
      step.classList.add('active');
    }
  });

  lines.forEach((line, index) => {
    line.classList.remove('completed');
    if (index < stepAtivo - 1) {
      line.classList.add('completed');
    }
  });
}

// ============================================
// VALIDAÇÃO INICIAL
// ============================================
(function () {
  console.log('🔧 API_URL configurada:', API_URL);
  if (!API_URL || API_URL.includes('SEU_ID_AQUI') || !API_URL.includes('script.google.com')) {
    console.error('❌ ERRO: API_URL não configurada corretamente!', API_URL);
    alert('ERRO: URL do Google Apps Script não configurada. Verifique o código.');
  }
})();

// ============================================
// CARREGAMENTO DE HORÁRIOS
// ============================================
async function carregarHorarios() {
  const loading = document.getElementById('loading');
  const formContainer = document.getElementById('form-container');
  const select = document.getElementById('slotSelect');

  loading.style.display = 'block';
  formContainer.style.display = 'none';

  try {
    if (!API_URL || API_URL.includes('SEU_ID_AQUI')) {
      throw new Error('URL do Google Apps Script não configurada. Verifique a constante API_URL no código.');
    }

    const url = API_URL + '?action=getSlots';
    console.log('🔍 Fazendo requisição para:', url);

    const resp = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });

    console.log('📡 Status da resposta:', resp.status, resp.statusText);

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error('Script não encontrado. Verifique se o Google Apps Script está publicado corretamente.');
      }
      throw new Error('Erro ao carregar horários (HTTP ' + resp.status + ')');
    }

    const slots = await resp.json();
    console.log('Slots recebidos do servidor:', slots);
    slotsGlobais = slots || [];

    if (!slotsGlobais.length) {
      loading.innerHTML = `
        <div class="loading-card">
          <div style="font-size: 3rem; margin-bottom: 8px;">😔</div>
          <p class="loading-text">Nenhum horário disponível</p>
          <p class="loading-subtext">Tente novamente mais tarde ou ligue para a unidade</p>
        </div>
      `;
      return;
    }

    select.innerHTML = '<option value="">Toque para escolher um horário</option>';
    slotsGlobais.forEach((slot, index) => {
      const option = document.createElement('option');
      option.value = index;

      const diaSemanaLabel = slot.diaSemana
        ? slot.diaSemana.replace('-feira', '')
        : '';

      const dataComDia = diaSemanaLabel
        ? diaSemanaLabel + ', ' + slot.data
        : slot.data;

      option.text = dataComDia + ' às ' + slot.hora;
      select.appendChild(option);
    });

    loading.style.display = 'none';
    formContainer.style.display = 'block';
  } catch (err) {
    console.error(err);
    loading.innerHTML = `
      <div class="loading-card">
        <div style="font-size: 3rem; margin-bottom: 8px;">⚠️</div>
        <p class="loading-text">Não foi possível carregar</p>
        <p class="loading-subtext" style="margin-bottom: 16px;">
          ${escapeHtml(err.message) || 'Verifique sua conexão com a internet'}
        </p>
        <button type="button" class="btn btn-primary" onclick="carregarHorarios()" style="max-width: 220px;">
          Tentar novamente
        </button>
      </div>
    `;
  }
}

// ============================================
// VALIDAÇÕES
// ============================================
function validarTelefone(telefone) {
  const apenasNumeros = telefone.replace(/\D/g, '');
  return apenasNumeros.length >= 10 && apenasNumeros.length <= 11;
}

function validarDataNascimento(data) {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!regex.test(data)) {
    return { valido: false, mensagem: 'Use o formato DD/MM/AAAA' };
  }

  const partes = data.split('/');
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  const ano = parseInt(partes[2], 10);

  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) {
    return { valido: false, mensagem: 'Data inválida. Verifique dia, mês e ano.' };
  }

  return { valido: true };
}

// ============================================
// GERENCIAMENTO DE ERROS
// ============================================
function mostrarErroCampo(campoId, mensagem) {
  const campo = document.getElementById(campoId);
  const errorSpan = document.getElementById(campoId + '-error');

  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.classList.add('error');
  }

  if (errorSpan) {
    errorSpan.textContent = mensagem;
  }
}

function limparErroCampo(campoId) {
  const campo = document.getElementById(campoId);
  const errorSpan = document.getElementById(campoId + '-error');

  if (campo) {
    campo.removeAttribute('aria-invalid');
    campo.classList.remove('error');
  }

  if (errorSpan) {
    errorSpan.textContent = '';
  }
}

function limparTodosErros() {
  ['slotSelect', 'nome', 'dataNascimento', 'telefone', 'observacoes'].forEach(limparErroCampo);
}

// ============================================
// VALIDAÇÃO DO FORMULÁRIO
// ============================================
function validarFormulario() {
  limparTodosErros();

  const select = document.getElementById('slotSelect');
  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const dataNascimento = document.getElementById('dataNascimento').value.trim();
  const observacoes = document.getElementById('observacoes').value.trim();

  let valido = true;
  let primeiroCampoComErro = null;

  if (!select.value) {
    mostrarErroCampo('slotSelect', 'Selecione um horário');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = select;
  }

  if (!nome || nome.length < 3) {
    mostrarErroCampo('nome', 'Informe seu nome completo');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('nome');
  }

  if (!dataNascimento) {
    mostrarErroCampo('dataNascimento', 'Informe sua data de nascimento');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('dataNascimento');
  } else {
    const validacaoData = validarDataNascimento(dataNascimento);
    if (!validacaoData.valido) {
      mostrarErroCampo('dataNascimento', validacaoData.mensagem);
      valido = false;
      if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('dataNascimento');
    }
  }

  if (!telefone) {
    mostrarErroCampo('telefone', 'Informe seu telefone');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('telefone');
  } else if (!validarTelefone(telefone)) {
    mostrarErroCampo('telefone', 'Telefone inválido');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('telefone');
  }

  if (!observacoes || observacoes.length < 5) {
    mostrarErroCampo('observacoes', 'Descreva o motivo da consulta');
    valido = false;
    if (!primeiroCampoComErro) primeiroCampoComErro = document.getElementById('observacoes');
  }

  if (!valido && primeiroCampoComErro) {
    primeiroCampoComErro.focus();
  }

  return valido;
}

// ============================================
// SANITIZAÇÃO DE HTML
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// CONSTRUÇÃO DO RESUMO
// ============================================
function construirResumoAgendamento(slot, nome, telefone, dataNascimento, observacoes) {
  const diaSemana = slot.diaSemana ? slot.diaSemana.replace('-feira', '') : '';
  const dataFormatada = diaSemana ? `${diaSemana}, ${slot.data}` : slot.data;

  // Escape user-provided data to prevent XSS
  const nomeEscaped = escapeHtml(nome);
  const telefoneEscaped = escapeHtml(telefone);
  const dataNascimentoEscaped = escapeHtml(dataNascimento);
  const observacoesEscaped = escapeHtml(observacoes);

  return `
    <div class="resumo-header">
      <div class="icon-ok" aria-hidden="true">✓</div>
      <div>
        <div class="resumo-titulo">Agendamento realizado!</div>
        <div class="resumo-subtitulo">Confira os dados e confirme no WhatsApp</div>
      </div>
    </div>
    
    <ul class="resumo-lista">
      <li>
        <strong>Data</strong>
        <span>${dataFormatada}</span>
      </li>
      <li>
        <strong>Horário</strong>
        <span class="resumo-chip">🕐 ${slot.hora}</span>
      </li>
      <li>
        <strong>Paciente</strong>
        <span>${nomeEscaped}</span>
      </li>
      <li>
        <strong>Telefone</strong>
        <span>${telefoneEscaped}</span>
      </li>
      <li>
        <strong>Nascimento</strong>
        <span>${dataNascimentoEscaped}</span>
      </li>
      <li>
        <strong>Motivo</strong>
        <span>${observacoesEscaped}</span>
      </li>
    </ul>

    <p class="resumo-footer">
      <strong>Importante:</strong> Para confirmar seu agendamento, clique no botão abaixo 
      e envie a mensagem pelo WhatsApp. Sem essa confirmação, o horário poderá não ser reservado.
    </p>
  `;
}

// ============================================
// CONSTRUÇÃO DA URL DO WHATSAPP
// ============================================
function construirUrlWhatsApp(slot, nome) {
  const diaSemana = slot.diaSemana ? slot.diaSemana.replace('-feira', '') : '';
  const dataFormatada = diaSemana ? `${diaSemana}, ${slot.data}` : slot.data;

  const texto = `Olá! Aqui é ${nome}. Acabei de solicitar um agendamento para ${dataFormatada} às ${slot.hora}. Poderia confirmar, por favor?`;

  return `https://wa.me/${WHATSAPP_DESTINO}?text=${encodeURIComponent(texto)}`;
}

// ============================================
// ENVIO DO AGENDAMENTO
// ============================================
async function enviarAgendamento(event) {
  if (event) event.preventDefault();

  if (!validarFormulario()) return;

  const select = document.getElementById('slotSelect');
  const idx = parseInt(select.value, 10);
  const slot = slotsGlobais[idx];

  if (!slot) {
    mostrarErroCampo('slotSelect', 'Horário inválido');
    return;
  }

  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const dataNascimento = document.getElementById('dataNascimento').value.trim();
  const observacoes = document.getElementById('observacoes').value.trim();

  const msgDiv = document.getElementById('mensagem');
  const waDiv = document.getElementById('whatsapp-container');
  const waLink = document.getElementById('whatsapp-link');
  const formFields = document.getElementById('form-fields');
  const submitBtn = document.getElementById('submit-btn');

  waDiv.style.display = 'none';

  // Estado de loading
  submitBtn.disabled = true;
  submitBtn.classList.add('btn-loading');

  msgDiv.className = 'msg';
  msgDiv.style.display = 'block';
  msgDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px 0;">
      <div style="width: 24px; height: 24px; border: 3px solid #ccfbf1; border-top-color: #0d9488; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span style="color: #64748b; font-weight: 500;">Processando seu agendamento...</span>
    </div>
  `;

  const dados = {
    rowIndex: slot.rowIndex,
    nome: nome,
    telefone: telefone,
    dataNascimento: dataNascimento,
    observacoes: observacoes
  };

  console.log('Enviando para API:', dados);

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(dados)
    });

    if (!resp.ok) {
      throw new Error('Erro ao agendar (HTTP ' + resp.status + ')');
    }

    const res = await resp.json();
    console.log('Resposta da API:', res);

    // Atualizar progress para step 3 (confirmação)
    atualizarProgressStep(3);

    msgDiv.className = 'msg sucesso';
    msgDiv.innerHTML = construirResumoAgendamento(slot, nome, telefone, dataNascimento, observacoes);

    waLink.href = construirUrlWhatsApp(slot, nome);
    waDiv.style.display = 'block';

    if (formFields) {
      formFields.style.display = 'none';
    }

    // Scroll suave para o topo do card
    const card = document.querySelector('.card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    console.error(err);

    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-loading');

    msgDiv.className = 'msg erro';
    msgDiv.innerHTML = `
      <div style="text-align: center;">
        <p style="font-weight: 600; margin-bottom: 8px;">Erro ao realizar agendamento</p>
        <p style="font-size: 14px; margin-bottom: 16px;">${err.message || 'Verifique sua conexão e tente novamente.'}</p>
      </div>
    `;

    msgDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ============================================
// MÁSCARAS DE INPUT
// ============================================
function aplicarMascaraTelefone(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length <= 2) {
    input.value = value ? '(' + value : '';
  } else if (value.length <= 7) {
    input.value = '(' + value.substring(0, 2) + ') ' + value.substring(2);
  } else if (value.length <= 10) {
    input.value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 6) + '-' + value.substring(6);
  } else {
    input.value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 7) + '-' + value.substring(7, 11);
  }
}

function aplicarMascaraData(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length > 2) {
    value = value.substring(0, 2) + '/' + value.substring(2);
  }
  if (value.length > 5) {
    value = value.substring(0, 5) + '/' + value.substring(5, 9);
  }

  input.value = value;
}

// ============================================
// VALIDAÇÃO EM TEMPO REAL
// ============================================
function configurarValidacaoEmTempoReal() {
  const campos = ['slotSelect', 'nome', 'dataNascimento', 'telefone', 'observacoes'];

  campos.forEach(campoId => {
    const campo = document.getElementById(campoId);
    if (!campo) return;

    campo.addEventListener('input', () => limparErroCampo(campoId));

    campo.addEventListener('blur', function () {
      const valor = campo.value.trim();
      if (!valor) return;

      if (campoId === 'telefone' && !validarTelefone(valor)) {
        mostrarErroCampo(campoId, 'Telefone inválido');
      } else if (campoId === 'dataNascimento') {
        const validacao = validarDataNascimento(valor);
        if (!validacao.valido) {
          mostrarErroCampo(campoId, validacao.mensagem);
        }
      }
    });
  });
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function () {
  carregarHorarios();

  // Máscaras
  const dataNascInput = document.getElementById('dataNascimento');
  if (dataNascInput) {
    dataNascInput.addEventListener('input', (e) => aplicarMascaraData(e.target));
  }

  const telefoneInput = document.getElementById('telefone');
  if (telefoneInput) {
    telefoneInput.addEventListener('input', (e) => aplicarMascaraTelefone(e.target));
  }

  // Validação em tempo real
  configurarValidacaoEmTempoReal();

  // Progress steps - atualizar ao selecionar horário
  const slotSelect = document.getElementById('slotSelect');
  if (slotSelect) {
    slotSelect.addEventListener('change', function () {
      if (this.value) {
        atualizarProgressStep(2);
      } else {
        atualizarProgressStep(1);
      }
    });
  }

  // Submit do formulário
  const form = document.getElementById('agendamento-form');
  if (form) {
    form.addEventListener('submit', enviarAgendamento);
  }
});

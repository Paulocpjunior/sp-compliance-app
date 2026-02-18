import { Obrigacao, RegimeTributario, ResultadoAnalise, AnnualObligation } from '../types/compliance';

export class RiskEngine {
  /**
   * Analisa obrigações fiscais e define risco/ação baseado no Regime Tributário e regras universais.
   * 
   * Lógica Implementada:
   * - Universais: FGTS (Risco Alto/Crítico), Taxas Municipais (TFE/TFA/ISS), IPVA.
   * - e-CAC Específicos: Transmissão Pendente, Divergência de Valor, Retificadora sem transmissão.
   * - Lucro Real/Presumido: ECD/ECF Pendentes -> Risco Crítico (Multas Pesadas).
   * - Simples Nacional: DEFIS Pendente -> Risco Médio/Alto.
   */
  public static analyzeObligations(
    obligations: Obrigacao[], 
    regime: RegimeTributario,
    cndMunicipalStatus?: string,
    annualObligations?: AnnualObligation[]
  ): ResultadoAnalise {
    let currentScore = 100;
    
    // Estado inicial padrão (Risco Baixo)
    let finalRisk: ResultadoAnalise['nivelRisco'] = 'Low';
    let finalAction = 'Monitoramento preventivo. Nenhuma pendência bloqueante detectada.';
    
    // Priority tracker for action messages (Critical > High > Medium > Low)
    // 0 = Low, 2 = Medium, 3 = High, 4 = Critical
    let actionPriority = 0; 

    // Análise direta do Status da CND Municipal (Simulação de Integração via API)
    if (cndMunicipalStatus && (cndMunicipalStatus === 'Com Pendências' || cndMunicipalStatus === 'Não Emitida')) {
        if (finalRisk === 'Low') {
            finalRisk = 'Medium';
        }
        const msg = `Regularizar pendências municipais (TFE/ISS/Alvará) para desbloquear a CND Municipal.`;
        if (actionPriority < 2) {
            finalAction = msg;
            actionPriority = 2;
        }
        currentScore -= 15;
    }

    // =========================================================
    // NOVA ANÁLISE: OBRIGAÇÕES ANUAIS (ECD, ECF, DEFIS)
    // =========================================================
    if (annualObligations && annualObligations.length > 0) {
        for (const ann of annualObligations) {
            // Regra 1: DEFIS Pendente (Simples Nacional)
            if (ann.name === 'DEFIS' && ann.status === 'Pendente') {
                if (finalRisk !== 'High' && finalRisk !== 'Critical') finalRisk = 'High';
                const msg = `URGENTE: DEFIS ${ann.exerciseYear} Pendente. Risco de exclusão do Simples Nacional.`;
                if (actionPriority < 3) {
                    finalAction = msg;
                    actionPriority = 3;
                }
                currentScore -= 30;
            }

            // Regra 2: ECD/ECF Pendente (Geralmente Presumido ou Real)
            if ((ann.name === 'ECD' || ann.name === 'ECF') && ann.status === 'Pendente') {
                finalRisk = 'Critical';
                const msg = `CRÍTICO: ${ann.name} ${ann.exerciseYear} não entregue. Multa percentual sobre o lucro/receita.`;
                if (actionPriority < 4) {
                    finalAction = msg;
                    actionPriority = 4;
                }
                currentScore -= 40;
            }
        }
    }

    for (const ob of obligations) {
      // Normalização para comparação segura (uppercase, trim)
      const tipo = (ob.tipo || '').toUpperCase().trim();
      const status = ob.status || 'Entregue';
      const diasAtraso = ob.diasAtraso || 0;
      
      // Acesso seguro a descrição detalhada (se existir no objeto simulado/real)
      const descricao = ((ob as any).descricaoDetalhada || '').toUpperCase();

      // Cálculo de Score: Penalização progressiva por atraso
      if (diasAtraso > 0) {
        currentScore -= Math.min(diasAtraso, 20); 
      }

      // 1. TRANSMISSÃO PENDENTE (DCTFWeb, E-Social, Reinf)
      if (descricao.includes('TRANSMISSÃO PENDENTE') || descricao.includes('TRANSMISSAO PENDENTE')) {
          if (finalRisk !== 'Critical') finalRisk = 'High';
          const msg = `ATENÇÃO: ${ob.tipo} consta como 'Transmissão Pendente' no e-CAC. Finalize o envio para liberar a CND.`;
          if (actionPriority < 3) {
              finalAction = msg;
              actionPriority = 3;
          }
          currentScore -= 25;
      }

      // 2. DIVERGÊNCIA DE VALOR (Guia vs Declarado)
      if (descricao.includes('DIVERGÊNCIA') || descricao.includes('DIVERGENCIA')) {
          if (finalRisk === 'Low') finalRisk = 'Medium';
          const msg = `Malha Fina: Divergência de valores detectada em ${ob.tipo}. Necessário retificar ou justificar.`;
          if (actionPriority < 2) {
              finalAction = msg;
              actionPriority = 2;
          }
          currentScore -= 15;
      }

      // REGRA: FGTS (Crítico/Alto)
      if (tipo.includes('FGTS') && status === 'Pendente') {
        if (finalRisk !== 'Critical') finalRisk = 'High';
        const msg = 'Regularizar FGTS imediatamente. CRF (Certificado de Regularidade) está bloqueado.';
        if (actionPriority < 3) {
            finalAction = msg;
            actionPriority = 3;
        }
        currentScore = Math.min(currentScore, 40);
      }

      // REGRA: Taxas Municipais (TFE, TFA, ISS)
      if ((tipo.includes('TFE') || tipo.includes('TFA') || tipo.includes('ISS')) && status === 'Pendente') {
        if (finalRisk !== 'High' && finalRisk !== 'Critical') {
            finalRisk = 'Medium';
        }
        const msg = 'Pendência Municipal detectada (TFE/ISS/Alvará). Bloqueia CND Municipal.';
        if (actionPriority < 2) {
            finalAction = msg;
            actionPriority = 2;
        }
        currentScore -= 15;
      }

      // REGRA: Taxas Estaduais (IPVA, ICMS)
      if ((tipo.includes('IPVA') || tipo.includes('INCENDIO') || tipo.includes('ICMS')) && status === 'Pendente') {
         currentScore -= 10;
         if (finalRisk === 'Low') {
             finalRisk = 'Medium';
         }
         const msg = 'Débitos estaduais (IPVA/ICMS/Taxas) pendentes. Regularize para evitar Dívida Ativa.';
         
         if (actionPriority < 2) {
             finalAction = msg;
             actionPriority = 2;
         }
      }

      // =========================================================
      // REGRAS ESPECÍFICAS DE REGIME
      // =========================================================

      // LUCRO REAL
      if (regime === 'Lucro Real') {
        const isCriticalObligation = tipo === 'DCTF' || tipo.startsWith('EFD') || tipo.includes('SPED');
        if (isCriticalObligation && status === 'Pendente') {
          finalRisk = 'Critical';
          const msg = `URGENTE: Pendência em ${ob.tipo} bloqueia CND Federal e gera multa pesada. Prioridade máxima.`;
          if (actionPriority < 4) {
             finalAction = msg;
             actionPriority = 4;
          }
          currentScore = 15;
        }
      }

      // LUCRO PRESUMIDO
      if (regime === 'Lucro Presumido') {
        const isEfdContribuicoes = tipo.includes('EFD CONTRIBU') || tipo.includes('EFD-CONTRIBU');
        if (isEfdContribuicoes && diasAtraso > 0) {
          if (finalRisk !== 'Critical') finalRisk = 'High';
          const msg = 'Regularizar entrega da EFD Contribuições. Sujeito a multa por atraso.';
          if (actionPriority < 3) {
             finalAction = msg;
             actionPriority = 3;
          }
          currentScore = Math.min(currentScore, 50);
        }
      }

      // SIMPLES NACIONAL
      if (regime === 'Simples Nacional') {
        const isPgdas = tipo.includes('PGDAS') || tipo.includes('PGDAS-D');
        if (isPgdas && status === 'Pendente' && diasAtraso > 0) {
           if (finalRisk !== 'Critical') finalRisk = 'High';
           const msg = 'Gerar e transmitir PGDAS-D imediatamente para evitar exclusão do Simples.';
           if (actionPriority < 3) {
               finalAction = msg;
               actionPriority = 3;
           }
           currentScore = Math.min(currentScore, 50);
        }
      }
    }

    // Ajuste de consistência
    if (finalRisk === 'Low' && currentScore < 70) {
      finalRisk = 'Medium';
      if (actionPriority < 2) {
          finalAction = 'Atenção: Múltiplos pequenos atrasos detectados. Revise o calendário fiscal.';
      }
    }
    
    return {
      nivelRisco: finalRisk,
      sugestaoAcao: finalAction,
      score: Math.max(0, currentScore)
    };
  }
}
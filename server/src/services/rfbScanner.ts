import { EcacService } from './ecacService';

export const scanRFB = async (pfxBase64: string, password: string) => {
    // Para simplificar a integração neste ponto, usamos o EcacService que já tem a inteligência do e-CAC
    const result = await EcacService.fetchSituacaoFiscal(Buffer.from(pfxBase64, 'base64'), password);
    return result;
};

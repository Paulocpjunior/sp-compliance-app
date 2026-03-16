import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL + '/api';

export class BackendService {
    /**
     * Uploads the certificate .pfx and password to the Node.js backend to scrape e-CAC.
     */
    static async auditEcac(file: File, password: string): Promise<any> {
        const formData = new FormData();
        formData.append('certificate', file);
        formData.append('password', password);

        try {
            const response = await axios.post(`${API_BASE_URL}/audit/ecac`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            if (response.data?.status === 'error') {
                throw new Error(response.data.message || 'Erro reportado pelo robô e-CAC.');
            }
            return response.data;
        } catch (error: any) {
            console.error("BackendService Error:", error);
            throw new Error(error.response?.data?.error || "Falha ao conectar com o Servidor de Automação.");
        }
    }

    static async auditPgfn(file: File, password: string): Promise<any> {
        const formData = new FormData();
        formData.append('certificate', file);
        formData.append('password', password);
        try {
            const res = await axios.post(`${API_BASE_URL}/audit/pgfn`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data?.status === 'error') throw new Error(res.data.message || 'Erro reportado pelo robô PGFN.');
            return res.data;
        } catch (e: any) { throw new Error(e.response?.data?.error || "Falha ao conectar com o Servidor PGFN."); }
    }

    static async auditPge(file: File, password: string): Promise<any> {
        const formData = new FormData();
        formData.append('certificate', file);
        formData.append('password', password);
        try {
            const res = await axios.post(`${API_BASE_URL}/audit/pge`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data?.status === 'error') throw new Error(res.data.message || 'Erro reportado pelo robô PGE.');
            return res.data;
        } catch (e: any) { throw new Error(e.response?.data?.error || "Falha ao conectar com o Servidor PGE."); }
    }

    static async auditEsocial(file: File, password: string): Promise<any> {
        const formData = new FormData();
        formData.append('certificate', file);
        formData.append('password', password);
        try {
            // Note: Update backend endpoint if it uses a different route
            const res = await axios.post(`${API_BASE_URL}/audit/esocial`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data?.status === 'error') throw new Error(res.data.message || 'Erro reportado pelo robô e-Social.');
            return res.data;
        } catch (e: any) { throw new Error(e.response?.data?.error || "Falha ao conectar com o Servidor e-Social."); }
    }
}

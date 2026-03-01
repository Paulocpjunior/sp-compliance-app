import { Router } from 'express';
import multer from 'multer';
import { EcacService } from '../services/ecacService';
import { GovBrService } from '../services/govbrService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/audit/ecac', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await EcacService.fetchSituacaoFiscal(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/audit/pgfn', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await GovBrService.scrapePGFN(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/audit/pge', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await GovBrService.scrapePGE(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post('/audit/esocial', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password) return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await GovBrService.scrapeESocial(req.file.buffer, req.body.password);
        return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get('/status', (req, res) => {
    res.json({ message: 'API is working' });
});

export default router;

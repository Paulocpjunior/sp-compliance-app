"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const ecacService_1 = require("../services/ecacService");
const govbrService_1 = require("../services/govbrService");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/audit/ecac', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password)
            return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await ecacService_1.EcacService.fetchSituacaoFiscal(req.file.buffer, req.body.password);
        return res.json(result);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
router.post('/audit/pgfn', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password)
            return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await govbrService_1.GovBrService.scrapePGFN(req.file.buffer, req.body.password);
        return res.json(result);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
router.post('/audit/pge', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password)
            return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await govbrService_1.GovBrService.scrapePGE(req.file.buffer, req.body.password);
        return res.json(result);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
router.post('/audit/esocial', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file || !req.body.password)
            return res.status(400).json({ error: 'Falta certificado ou senha.' });
        const result = await govbrService_1.GovBrService.scrapeESocial(req.file.buffer, req.body.password);
        return res.json(result);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
router.get('/status', (req, res) => {
    res.json({ message: 'API is working' });
});
exports.default = router;

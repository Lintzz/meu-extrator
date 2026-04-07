const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();

// Permite que o seu site na Vercel acesse essa API sem bloqueios de segurança (CORS)
app.use(cors()); 

app.get('/api/extrair', async (req, res) => {
    const urlDoProduto = req.query.url;

    if (!urlDoProduto) {
        return res.status(400).json({ erro: 'URL não fornecida' });
    }

    let browser = null;
    try {
        console.log('🚀 Iniciando navegador para:', urlDoProduto);
        browser = await puppeteer.launch({ 
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Importante para o Render
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        await page.goto(urlDoProduto, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Espera pelo título (se não achar em 10s, tenta extrair mesmo assim)
        await page.waitForSelector('.ui-pdp-title', { timeout: 10000 }).catch(() => console.log('Seletor não encontrado rápido, continuando...'));

        const resultado = await page.evaluate(() => {
            const titulo = document.querySelector('.ui-pdp-title')?.innerText || "";
            const precoMeta = document.querySelector('meta[itemprop="price"]')?.content || "";
            const precoFração = document.querySelector('.andes-money-amount__fraction')?.innerText || "";
            const imgElement = document.querySelector('.ui-pdp-image.ui-pdp-gallery__figure__image');
            const imagem = imgElement?.getAttribute('data-zoom') || imgElement?.src || "";

            return {
                nome: titulo,
                preco: precoMeta || precoFração,
                foto: imagem
            };
        });

        await browser.close();
        res.json(resultado);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (browser) await browser.close();
        res.status(500).json({ erro: 'Falha ao extrair dados' });
    }
});

// O Render injeta automaticamente a porta na variável PORT, ou usamos 3001 localmente
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Extrator rodando na porta ${PORT}`);
});
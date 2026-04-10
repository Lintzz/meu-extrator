const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

// Rota inicial só para o UptimeRobot saber que a API está online
app.get('/', (req, res) => {
    res.status(200).send('API do Extrator Online e pronta para o trabalho! 🚀');
});

app.get('/api/extrair', async (req, res) => {
    const urlDoProduto = req.query.url;

    if (!urlDoProduto) {
        return res.status(400).json({ erro: 'URL não fornecida' });
    }

    let browser = null;
    try {
        console.log('🚀 Recebido link:', urlDoProduto);
        
        // 1. DESCOBRE DE QUAL SITE É O LINK
        let dominio;
        try {
            dominio = new URL(urlDoProduto).hostname.toLowerCase();
        } catch (e) {
            return res.status(400).json({ erro: 'Link inválido.' });
        }

        // 2. FILTRO DE SEGURANÇA: Só permite os 3 sites
        if (!dominio.includes('mercadolivre.com.br') && 
            !dominio.includes('amazon.com.br') && 
            !dominio.includes('kabum.com.br')) {
            console.log('❌ Site não suportado:', dominio);
            return res.status(400).json({ 
                erro: 'Site não suportado. Por favor, cole um link do Mercado Livre, Amazon ou KaBuM!.' 
            });
        }

        console.log('🚀 Iniciando navegador para:', dominio);
        browser = await puppeteer.launch({ 
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        // 👇 ADICIONE ESTE BLOCO AQUI (O "TURBO") 👇
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            // Se for imagem, estilo (CSS) ou fonte, a gente bloqueia!
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });
        // 👆 FIM DO BLOCO TURBO 👆

        // Carrega a página (espera até o DOM carregar para ser mais rápido)
        await page.goto(urlDoProduto, { waitUntil: 'domcontentloaded', timeout: 60000 });

        let resultado = { nome: "", preco: "", foto: "" };

        // 3. REGRAS DO MERCADO LIVRE
        if (dominio.includes('mercadolivre.com.br')) {
            console.log('🔍 Extraindo do Mercado Livre...');
            await page.waitForSelector('.ui-pdp-title', { timeout: 10000 }).catch(() => {});
            
            resultado = await page.evaluate(() => {
                const titulo = document.querySelector('.ui-pdp-title')?.innerText || "";
                const precoMeta = document.querySelector('meta[itemprop="price"]')?.content || "";
                const precoFração = document.querySelector('.andes-money-amount__fraction')?.innerText || "";
                const imgElement = document.querySelector('.ui-pdp-image.ui-pdp-gallery__figure__image');
                const imagem = imgElement?.getAttribute('data-zoom') || imgElement?.src || "";

                return { nome: titulo, preco: precoMeta || precoFração, foto: imagem };
            });
        } 
        
        // 4. REGRAS DA AMAZON
        else if (dominio.includes('amazon.com.br')) {
            console.log('🔍 Extraindo da Amazon...');
            await page.waitForSelector('#productTitle', { timeout: 10000 }).catch(() => {});
            
            resultado = await page.evaluate(() => {
                const titulo = document.querySelector('#productTitle')?.innerText?.trim() || "";
                const precoInteiro = document.querySelector('.a-price-whole')?.innerText?.replace(/[\n\r]/g, '') || "";
                const precoFracao = document.querySelector('.a-price-fraction')?.innerText || "";
                const imagem = document.querySelector('#landingImage')?.src || document.querySelector('#imgBlkFront')?.src || "";
                
                let precoFinal = "";
                if (precoInteiro) {
                    // Junta os inteiros com os centavos (Ex: "323" + "00" vira "323,00")
                    precoFinal = precoInteiro + (precoFracao ? "," + precoFracao : "");
                }

                return { nome: titulo, preco: precoFinal, foto: imagem };
            });
        }

        // 5. REGRAS DA KABUM
        else if (dominio.includes('kabum.com.br')) {
            console.log('🔍 Extraindo da KaBuM!...');
            await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
            
            resultado = await page.evaluate(() => {
                const titulo = document.querySelector('h1')?.innerText || "";
                const preco = document.querySelector('h4')?.innerText?.replace('R$', '')?.trim() || "";
                // Na Kabum é mais seguro pegar a imagem direto dos meta-dados (ocultos) do site
                const imagem = document.querySelector('meta[property="og:image"]')?.content || "";

                return { nome: titulo, preco: preco, foto: imagem };
            });
        }

        await browser.close();
        res.json(resultado);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (browser) await browser.close();
        res.status(500).json({ erro: 'Falha ao extrair dados' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Extrator rodando na porta ${PORT}`);
});
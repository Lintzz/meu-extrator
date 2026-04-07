const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Isso força o Puppeteer a baixar o Chrome para dentro da pasta do projeto
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
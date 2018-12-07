const _ = require('koa-route');
const Koa = require('koa');
const app = new Koa();

const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const request = require('request');
const util = require('util');
const log = require('lighthouse-logger');
const URL = require('url');

app.use(_.get('/service/gtg', ctx => ctx.body = '"OK"'));
app.use(_.get('/(.*)', async (ctx, url) => {
  const uri = URL.parse(url);
  ctx.assert(uri.protocol, 400, `URL ${url} was invalid`);
  ctx.assert(uri.host, 400, `URL ${url} was invalid`);
  ctx.assert(uri.path, 400, `URL ${url} was invalid`);

  async function run() {
    const opts = {
      chromeFlags: ['--headless', '--show-paint-rects'],
      logLevel: 'info',
      output: 'json'
    };

    log.setLevel(opts.logLevel);

    // Launch chrome using chrome-launcher.
    const chrome = await chromeLauncher.launch(opts);
    opts.port = chrome.port;

    // Connect to it using puppeteer.connect().
    const resp = await util.promisify(request)(`http://localhost:${opts.port}/json/version`);
    const {webSocketDebuggerUrl} = JSON.parse(resp.body);
    const browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});

    // Run Lighthouse.
    const {lhr}  = await lighthouse(url, opts, null);

    await browser.disconnect();
    await chrome.kill();

    return lhr;
  }

  ctx.body = await run();
}));

app.listen(8080);
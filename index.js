const logging = require('./lib/logging');
logging.initialise({ environment: 'web' });
const logger = logging.getLogger();
const auditLogger = logging.getAuditLogger();
const requestInfo = logging.requestInfo;
const auditEventType = logging.auditEventType;

const _ = require('koa-route');
const Koa = require('koa');
const app = new Koa();

const http = require('http');
const https = require('https');

const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const request = require('request');
const util = require('util');
const log = require('lighthouse-logger');
const URL = require('url');

app.use(_.get('/service/gtg', ctx => ctx.body = '"OK"'));
app.use(_.get('/(.*)', async (ctx, url) => {
  ctx.assert(url, 400, `URL ${url} was invalid`);
  const uri = URL.parse(url);
  ctx.assert(uri.protocol, 400, `URL ${url} was invalid`);
  ctx.assert(uri.host, 400, `URL ${url} was invalid`);
  ctx.assert(uri.path, 400, `URL ${url} was invalid`);

  logger.info(`Testing ${url}`);

  async function run() {
    const opts = {
      chromeFlags: ['--headless', '--show-paint-rects'],
      logLevel: 'silent',
      output: 'json'
    };

    log.setLevel(opts.logLevel);

    // Launch chrome using chrome-launcher.
    logger.info("Launching Chrome");
    const chrome = await chromeLauncher.launch(opts);
    opts.port = chrome.port;

    // Connect to it using puppeteer.connect().
    logger.info("Awaiting response");
    const resp = await util.promisify(request)(`http://localhost:${opts.port}/json/version`);
    const {webSocketDebuggerUrl} = JSON.parse(resp.body);
    logger.info("Connecting with Puppeteer");
    const browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});

    // Run Lighthouse.
    logger.info("Running Lighthouse audit");
    const {lhr}  = await lighthouse(url, opts, null);

    logger.info("Shutting down Chrome");
    await browser.disconnect();
    await chrome.kill();

    const scores = {};
    Object.values(lhr.categories).forEach(c => scores[c.id] = c.score);

    auditLogger.log(
      requestInfo(auditEventType.lighthouse),
      {
        success: true,
        uri: uri.href,
        scores,
      },
    );

    return lhr;
  }

  ctx.body = await run();
}));

// A function that runs in the context of the http server
// and reports what type of server listens on which port
function listeningReporter() {
  // `this` refers to the http server here
  const { address, port } = this.address();
  const protocol = this.addContext ? 'https' : 'http';
  logger.info(`Listening on ${protocol}://${address}:${port}...`);
}

const port = process.env.PORT || 8080;
logger.info('Starting http server on port %s.', port);
http.createServer(app.callback())
  .listen(port, "0.0.0.0", listeningReporter);

if (process.env.HTTPS_PORT) {
  const sslPort = process.env.HTTPS_PORT;
  const sslOptions = {
    key: fs.readFileSync(process.env.HTTPS_KEY, 'utf8'),
    cert: fs.readFileSync(process.env.HTTPS_CRT, 'utf8')
  };

  https.createServer(sslOptions, app.callback())
    .listen(sslPort, "0.0.0.0", listeningReporter)
}

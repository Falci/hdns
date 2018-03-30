#!/usr/bin/env node

'use strict';

const dns = require('../');
const IP = require('binet');
const util = require('bns/lib/util');
const pkg = require('../package.json');

let name = null;
let type = null;
let host = null;
let key = null;
let port = 53;
let inet6 = null;
let reverse = false;
let json = false;
let rd = true;
let edns = false;
let dnssec = false;
let short = false;
let debug = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];

  if (arg.length === 0)
    throw new Error(`Unexpected argument: ${arg}.`);

  switch (arg) {
    case '-4':
      inet6 = false;
      break;
    case '-6':
      inet6 = true;
      break;
    case '-x':
      reverse = true;
      break;
    case '-p':
      port = util.parseU16(process.argv[i + 1]);
      i += 1;
      break;
    case '-j':
      json = true;
      break;
    case '-q':
      name = arg;
      break;
    case '-t':
      type = arg;
      break;
    case '-h':
    case '--help':
    case '-?':
    case '-v':
      console.log(`hdig.js ${pkg.version}`);
      process.exit(0);
      break;
    case '+edns':
      edns = true;
      break;
    case '+noedns':
      edns = false;
      break;
    case '+dnssec':
      edns = true;
      dnssec = true;
      break;
    case '+nodnssec':
      dnssec = false;
      break;
    case '+rd':
      rd = true;
      break;
    case '+nord':
      rd = false;
      break;
    case '+json':
      json = true;
      break;
    case '+nojson':
      json = false;
      break;
    case '+short':
      short = true;
      break;
    case '+noshort':
      short = false;
      break;
    case '+debug':
      debug = true;
      break;
    case '+nodebug':
      debug = false;
      break;
    default:
      if (arg[0] === '@') {
        const addr = IP.fromHost(arg.substring(1));
        host = addr.host;
        key = addr.key;
        break;
      }

      if (!name) {
        name = arg;
        break;
      }

      if (!type) {
        type = arg;
        break;
      }

      throw new Error(`Unexpected argument: ${arg}.`);
  }
}

if (!name)
  name = '.';

if (!type)
  type = 'A';

async function lookup(name) {
  const options = { all: true, hints: dns.ADDRCONFIG };
  const addrs = await dns.lookup(host, options);
  const {address} = util.randomItem(addrs);
  return address;
}

async function resolve(name, type, options) {
  const {host, port, key} = options;
  const resolver = new dns.Resolver(options);

  if (options.debug) {
    resolver.on('error', (err) => {
      console.error(err.stack);
    });

    resolver.on('log', (...args) => {
      console.error(...args);
    });
  }

  if (host) {
    const server = IP.toHost(host, port, key);
    resolver.setServers([server]);
  }

  if (options.reverse)
    return resolver.reverseRaw(name);

  return resolver.resolveRaw(name, type);
}

function printHeader(host) {
  const argv = process.argv.slice(2).join(' ');
  process.stdout.write('\n');
  process.stdout.write(`; <<>> hdig.js ${pkg.version} <<>> ${argv}\n`);
  if (host)
    process.stdout.write('; (1 server found)\n');
  process.stdout.write(';; global options: +cmd\n');
}

(async () => {
  if (host && !util.isIP(host))
    host = await lookup(host);

  const now = Date.now();

  const res = await resolve(name, type, {
    host,
    key,
    port,
    inet6,
    reverse,
    rd,
    edns,
    dnssec,
    debug
  });

  const ms = Date.now() - now;

  if (json) {
    const text = JSON.stringify(res.toJSON(), null, 2);
    process.stdout.write(text + '\n');
  } else {
    if (short) {
      process.stdout.write(res.toShort(name, type));
    } else {
      printHeader(host);
      process.stdout.write(';; Got answer:\n');
      process.stdout.write(res.toString(ms, host, port) + '\n');
    }
  }
})().catch((err) => {
  if (json) {
    console.error(err.message);
    process.exit(1);
  } else {
    if (short) {
      process.stdout.write(err.message + '\n');
    } else {
      printHeader(host);
      process.stdout.write(`;; error; ${err.stack}\n`);
    }
  }
});

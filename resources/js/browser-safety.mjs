import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(ip,prefix);
for (const [ip,prefix] of [['::',96],['fc00::',7],['fe80::',10],['ff00::',8]]) blocked.addSubnet(ip,prefix,'ipv6');

export async function publicUrl(value, resolve = lookup) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('Use a public HTTP or HTTPS website on its standard port.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{address:host, family:isIP(host)}] : await resolve(host, {all:true});
  if (!addresses.length || addresses.some(a => blocked.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))) throw new Error('Local and private network addresses cannot be opened by the test browser.');
  return url;
}

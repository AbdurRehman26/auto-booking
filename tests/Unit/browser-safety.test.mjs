import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicUrl } from '../../resources/js/browser-safety.mjs';

test('public IPv4 and IPv6 websites are allowed', async () => {
  for (const url of ['https://193.27.22.22', 'https://[2606:4700:10::6814:179a]']) {
    assert.equal((await publicUrl(url)).hostname, new URL(url).hostname);
  }
});

test('private, loopback, link-local and mapped addresses are rejected', async () => {
  for (const host of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.1.1', '169.254.169.254', '0.0.0.0', '2130706433', '[::1]', '[::ffff:127.0.0.1]', '[fc00::1]', '[fe80::1]']) {
    await assert.rejects(publicUrl(`http://${host}`), /private network/);
  }
});

test('a hostname resolving to any private address is rejected', async () => {
  await assert.rejects(publicUrl('https://example.com', async () => [{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]), /private network/);
});

test('credentials, non-web protocols and nonstandard ports are rejected', async () => {
  for (const url of ['file:///etc/passwd', 'ftp://example.com', 'https://user:pass@example.com', 'http://example.com:8000']) {
    await assert.rejects(publicUrl(url), /public HTTP or HTTPS/);
  }
});

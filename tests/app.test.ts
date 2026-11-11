// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = new TextDecoder().decode(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html')));
const body = /<body>([\s\S]*)<\/body>/.exec(html)![1].replace(/<script[\s\S]*?<\/script>/g, '');
const code = '1-0856-0540-15-12-01-1-1';

async function loadApp(search: string): Promise<void> {
  history.replaceState(null, '', `/${search}`);
  document.body.innerHTML = body;
  vi.resetModules();
  await import('../src/app/main');
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  vi.restoreAllMocks();
});

describe('app', () => {
  it('has no preview elements', async () => {
    await loadApp('');
    expect(document.querySelector('[id$="-preview"]')).toBeNull();
    expect(document.getElementById('card-preview')).toBeNull();
    expect((document.getElementById('code-dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('opens the code dialog from ?code= and generates a PDF from it', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:test');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await loadApp(`?code=${code}`);
    expect((document.getElementById('code-dialog') as HTMLDialogElement).open).toBe(true);
    expect((document.getElementById('configCode') as HTMLInputElement).value).toBe(code);

    document.getElementById('code-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1), { timeout: 15000 });
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  }, 20000);
});

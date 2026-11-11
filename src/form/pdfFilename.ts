import type { GeneratorParameters, PassphraseParameters } from '../generator/params';
import { encodeSeedConfigCode, encodePassphraseConfigCode } from '../generator/configCode';

// diyseed_seed<code>_pass<code>.pdf, or just the part that is generated, so a
// downloaded PDF names the card code it regenerates from.
export function pdfFilename(seed: GeneratorParameters | null, passphrase: PassphraseParameters | null): string {
  const parts = ['diyseed'];
  if (seed) parts.push(`seed${encodeSeedConfigCode(seed)}`);
  if (passphrase) parts.push(`pass${encodePassphraseConfigCode(passphrase)}`);
  return `${parts.join('_')}.pdf`;
}

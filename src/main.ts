import { generateStencilPdf, StencilInput } from './generator/writer';
import {
  validate,
  toGeneratorParameters,
  toPassphraseParameters,
  DEFAULT_FORM_VALUES,
  FormValues,
  FieldError,
} from './ui/form';
import { EncodingType } from './generator/encoding';
import { GeneratorParameters } from './generator/params';
import { computePreviewLayout, computePassphrasePreviewLayout } from './ui/preview';
import { renderPreview } from './ui/renderPreview';

function readForm(): FormValues {
  const num = (id: string, fallback: number) => {
    const el = document.getElementById(id) as HTMLInputElement;
    const value = Number(el.value);
    return el.value === '' ? fallback : value;
  };
  const checked = (id: string, fallback: boolean) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return el ? el.checked : fallback;
  };
  const encodingEl = document.getElementById('encoding') as HTMLSelectElement;
  const binaryDirectionEl = document.getElementById('binaryDirectionVertical') as HTMLInputElement | null;
  const passphraseDirectionEl = document.getElementById('passphraseDirectionVertical') as HTMLInputElement | null;
  const overrideEl = document.getElementById('passphraseOverrideCellSize') as HTMLInputElement | null;
  const overrideValueEl = document.getElementById('passphraseCellSizeMm') as HTMLInputElement | null;

  return {
    includeSeed: checked('includeSeed', true),
    seedLength: num('seedLength', DEFAULT_FORM_VALUES.seedLength),
    cardCount: num('cardCount', DEFAULT_FORM_VALUES.cardCount),
    cardWidthMm: num('cardWidthMm', DEFAULT_FORM_VALUES.cardWidthMm),
    cardHeightMm: num('cardHeightMm', DEFAULT_FORM_VALUES.cardHeightMm),
    cardSplit: num('cardSplit', DEFAULT_FORM_VALUES.cardSplit),
    cardPaddingMm: num('cardPaddingMm', DEFAULT_FORM_VALUES.cardPaddingMm),
    copies: num('copies', DEFAULT_FORM_VALUES.copies),
    encoding: Number(encodingEl.value) as EncodingType,
    binaryDirection: binaryDirectionEl?.checked ? 'vertical' : 'horizontal',
    passphrase: {
      enabled: checked('includePassphrase', false),
      cardCount: num('passphraseCardCount', DEFAULT_FORM_VALUES.passphrase.cardCount),
      binaryDirection: passphraseDirectionEl?.checked ? 'vertical' : 'horizontal',
      overrideCellSizeMm: overrideEl?.checked && overrideValueEl && overrideValueEl.value !== '' ? Number(overrideValueEl.value) : null,
    },
  };
}

function clearFieldErrors(fields: string[]): void {
  for (const field of fields) {
    document.getElementById(field)?.removeAttribute('aria-invalid');
    document.getElementById(`${field}-error`)?.remove();
  }
}

const ALL_FIELD_IDS = [
  'includeSeed',
  'seedLength',
  'cardCount',
  'cardWidthMm',
  'cardHeightMm',
  'cardSplit',
  'cardPaddingMm',
  'copies',
  'encoding',
  'passphraseCardCount',
  'passphraseOverrideCellSizeMm',
];

function renderErrors(errors: FieldError[]): void {
  const list = document.getElementById('form-errors') as HTMLUListElement;
  list.innerHTML = '';
  clearFieldErrors(ALL_FIELD_IDS);

  for (const error of errors) {
    const item = document.createElement('li');
    item.textContent = error.message;
    list.appendChild(item);

    const input = document.getElementById(error.field);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      const errorSpan = document.createElement('span');
      errorSpan.id = `${error.field}-error`;
      errorSpan.className = 'field-error';
      errorSpan.textContent = error.message;
      input.insertAdjacentElement('afterend', errorSpan);
    }
  }
}

function renderGeneralError(message: string): void {
  const list = document.getElementById('form-errors') as HTMLUListElement;
  list.innerHTML = '';
  clearFieldErrors(ALL_FIELD_IDS);
  const item = document.createElement('li');
  item.textContent = message;
  list.appendChild(item);
}

const SEED_REQUIRED_FIELD_IDS = ['seedLength', 'cardCount', 'cardWidthMm', 'cardHeightMm'];

function hasEmptyRequiredField(values: FormValues): boolean {
  if (values.includeSeed && SEED_REQUIRED_FIELD_IDS.some((id) => (document.getElementById(id) as HTMLInputElement | null)?.value === '')) {
    return true;
  }
  if (values.passphrase.enabled && (document.getElementById('passphraseCardCount') as HTMLInputElement | null)?.value === '') {
    return true;
  }
  return false;
}

function updateCardSplitVisibility(): void {
  const encodingEl = document.getElementById('encoding') as HTMLSelectElement | null;
  const cardSplitInput = document.getElementById('cardSplit');
  const cardSplitLabel = cardSplitInput?.closest('label');
  const hint = document.getElementById('cardSplit-hint');
  if (!encodingEl || !cardSplitLabel) return;

  const isBinary = Number(encodingEl.value) === EncodingType.Binary;
  cardSplitLabel.classList.toggle('is-hidden', isBinary);
  hint?.classList.toggle('is-hidden', isBinary);
}

function updateBinaryDirectionVisibility(): void {
  const encodingEl = document.getElementById('encoding') as HTMLSelectElement | null;
  const directionInput = document.getElementById('binaryDirectionVertical');
  const directionLabel = directionInput?.closest('label');
  const hint = document.getElementById('binaryDirection-hint');
  if (!encodingEl || !directionLabel) return;

  const isBinary = Number(encodingEl.value) === EncodingType.Binary;
  directionLabel.classList.toggle('is-hidden', !isBinary);
  hint?.classList.toggle('is-hidden', !isBinary);
}

function updateSectionVisibility(): void {
  const includeSeedEl = document.getElementById('includeSeed') as HTMLInputElement | null;
  const includePassphraseEl = document.getElementById('includePassphrase') as HTMLInputElement | null;
  const seedFields = document.getElementById('seed-fields');
  const seedAdvancedFields = document.getElementById('seed-advanced-fields');
  const passphraseFields = document.getElementById('passphrase-fields');
  if (!includeSeedEl || !includePassphraseEl) return;

  seedFields?.classList.toggle('is-hidden', !includeSeedEl.checked);
  seedAdvancedFields?.classList.toggle('is-hidden', !includeSeedEl.checked);
  passphraseFields?.classList.toggle('is-hidden', !includePassphraseEl.checked);
}

function updatePassphraseOverrideVisibility(): void {
  const overrideEl = document.getElementById('passphraseOverrideCellSize') as HTMLInputElement | null;
  const label = document.getElementById('passphraseCellSizeMmLabel');
  const hint = document.getElementById('passphraseCellSizeMm-hint');
  if (!overrideEl) return;

  label?.classList.toggle('is-hidden', !overrideEl.checked);
  hint?.classList.toggle('is-hidden', !overrideEl.checked);
}

function updatePreview(): void {
  const previewEl = document.getElementById('preview-panel');
  if (!previewEl) return;

  updateCardSplitVisibility();
  updateBinaryDirectionVisibility();
  updateSectionVisibility();
  updatePassphraseOverrideVisibility();

  const values = readForm();

  if (hasEmptyRequiredField(values)) {
    renderPreview(previewEl, null, null);
    return;
  }

  const errors = validate(values);
  if (errors.length > 0) {
    renderPreview(previewEl, null, null);
    return;
  }

  try {
    const seedParams = values.includeSeed ? toGeneratorParameters(values) : null;
    const seedLayout = seedParams ? computePreviewLayout(seedParams) : null;
    const passphraseParams = values.passphrase.enabled ? toPassphraseParameters(values, seedParams) : null;
    const passphraseLayout = passphraseParams ? computePassphrasePreviewLayout(passphraseParams) : null;
    renderPreview(previewEl, seedLayout, passphraseLayout);
  } catch {
    renderPreview(previewEl, null, null);
  }
}

function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildFilename(values: FormValues): string {
  const parts: string[] = ['hobohodl'];
  if (values.includeSeed) {
    parts.push(`${values.seedLength}words-${values.cardCount}cards`);
  }
  if (values.passphrase.enabled) {
    parts.push(`passphrase-${values.passphrase.cardCount}cards`);
  }
  parts.push(`${values.cardWidthMm}x${values.cardHeightMm}mm`);
  return `${parts.join('-')}.pdf`;
}

document.getElementById('generator-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = readForm();
  const errors = validate(values);
  renderErrors(errors);
  if (errors.length > 0) return;

  try {
    const seedParams: GeneratorParameters | null = values.includeSeed ? toGeneratorParameters(values) : null;
    const input: StencilInput = {
      seed: seedParams ?? undefined,
      passphrase: values.passphrase.enabled ? toPassphraseParameters(values, seedParams) : undefined,
    };
    const bytes = await generateStencilPdf(input);
    downloadPdf(bytes, buildFilename(values));
  } catch (error) {
    renderGeneralError(error instanceof Error ? error.message : 'Failed to generate PDF.');
  }
});

document.getElementById('generator-form')?.addEventListener('input', updatePreview);
updatePreview();

import { generateStencilPdf, StencilInput } from './generator/writer';
import { decodeConfigCode, ConfigCodeError, DecodedConfigCode } from './generator/configCode';
import {
  validate,
  toGeneratorParameters,
  toPassphraseParameters,
  isSeedSectionActive,
  isPassphraseSectionActive,
  hasAnyOutputSelected,
  DEFAULT_FORM_VALUES,
  FormValues,
  FieldError,
} from './ui/form';
import { EncodingType } from './generator/encoding';
import { GeneratorParameters, PassphraseParameters } from './generator/params';
import { pdfFilename } from './ui/pdfFilename';
import { codeFromSearch } from './ui/codeLink';
import { cardDiagram } from './ui/cardDiagram';
import { computePreviewLayout, computePassphrasePreviewLayout } from './ui/preview';
import { renderSeedPreview, renderPassphrasePreview, STENCIL_UNCHECKED_PLACEHOLDER_TEXT } from './ui/renderPreview';

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

  // Stencil/reader/wordlist and Passphrase's own equivalents live nested
  // inside their own section now, hidden (but not reset) once that
  // section's own checkbox is off - so their stale DOM state must not leak
  // through as "chosen" while the user has no way to see or toggle them.
  const includeSeed = checked('includeSeed', true);
  const includePassphrase = checked('includePassphrase', DEFAULT_FORM_VALUES.passphrase.enabled);

  return {
    includeSeed,
    includeSeedStencil: includeSeed && checked('includeSeedStencil', DEFAULT_FORM_VALUES.includeSeedStencil),
    includeSeedReader: includeSeed && checked('includeSeedReader', DEFAULT_FORM_VALUES.includeSeedReader),
    seedLength: num('seedLength', DEFAULT_FORM_VALUES.seedLength),
    cardCount: num('cardCount', DEFAULT_FORM_VALUES.cardCount),
    cardWidthMm: num('cardWidthMm', DEFAULT_FORM_VALUES.cardWidthMm),
    cardHeightMm: num('cardHeightMm', DEFAULT_FORM_VALUES.cardHeightMm),
    cardSplit: num('cardSplit', DEFAULT_FORM_VALUES.cardSplit),
    cardPaddingMm: num('cardPaddingMm', DEFAULT_FORM_VALUES.cardPaddingMm),
    copies: num('copies', DEFAULT_FORM_VALUES.copies),
    encoding: Number(encodingEl.value) as EncodingType,
    passphrase: {
      enabled: includePassphrase,
      includeStencil: includePassphrase && checked('includePassphraseStencil', DEFAULT_FORM_VALUES.passphrase.includeStencil),
      includeReader: includePassphrase && checked('includePassphraseReader', DEFAULT_FORM_VALUES.passphrase.includeReader),
      // No UI control for this - always a single card. The underlying model
      // still supports more (see PassphraseFormValues/toPassphraseParameters),
      // just nothing here exposes it.
      cardCount: 1,
      copies: num('passphraseCopies', DEFAULT_FORM_VALUES.passphrase.copies),
      cellSizeMm: num('passphraseCellSizeMm', DEFAULT_FORM_VALUES.passphrase.cellSizeMm),
    },
    includeAsciiTable: includePassphrase && checked('includeAsciiTable', DEFAULT_FORM_VALUES.includeAsciiTable),
    includeSeedWordTable: includeSeed && checked('includeSeedWordTable', DEFAULT_FORM_VALUES.includeSeedWordTable),
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
  'passphraseCopies',
  'passphraseCellSizeMm',
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

const SHARED_REQUIRED_FIELD_IDS = ['cardWidthMm', 'cardHeightMm'];
const SEED_REQUIRED_FIELD_IDS = ['seedLength', 'cardCount'];

function hasEmptyRequiredField(values: FormValues): boolean {
  const isEmpty = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value === '';
  // Card properties are always visible, so always required.
  if (SHARED_REQUIRED_FIELD_IDS.some(isEmpty)) {
    return true;
  }
  if (isSeedSectionActive(values) && SEED_REQUIRED_FIELD_IDS.some(isEmpty)) {
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

function setDisabled(id: string, disabled: boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.disabled = disabled;
}

// The Seed/Passphrase boxes themselves stay visible always now (their own
// checkbox lives in their title, not a separate top-level toggle) - only
// their body (fields, Advanced options, Preview) hides when unchecked. The
// three nested Stencil/reader/reference checkboxes stay visible either way,
// just disabled while their section is off, since they mean nothing without
// it (matches how readForm() already zeroes them out).
function updateSectionVisibility(values: FormValues): void {
  const seedActive = isSeedSectionActive(values);
  const passphraseActive = isPassphraseSectionActive(values);

  document.getElementById('seed-fields-body')?.classList.toggle('is-hidden', !seedActive);
  document.getElementById('passphrase-fields-body')?.classList.toggle('is-hidden', !passphraseActive);
  document.getElementById('seed-inactive-notice')?.classList.toggle('is-hidden', seedActive);
  document.getElementById('passphrase-inactive-notice')?.classList.toggle('is-hidden', passphraseActive);

  setDisabled('includeSeedStencil', !seedActive);
  setDisabled('includeSeedReader', !seedActive);
  setDisabled('includeSeedWordTable', !seedActive);
  setDisabled('includePassphraseStencil', !passphraseActive);
  setDisabled('includePassphraseReader', !passphraseActive);
  setDisabled('includeAsciiTable', !passphraseActive);
}

// The Generate button only appears once at least one of the six nested
// checkboxes (Stencil/reader/reference table, per section) is actually
// checked - opening a section alone doesn't yet select anything to produce.
function updateGenerateButtonVisibility(values: FormValues): void {
  const button = document.querySelector('#generator-form button[type="submit"]');
  button?.classList.toggle('is-hidden', !hasAnyOutputSelected(values));
}

function updatePreview(): void {
  const seedPreviewEl = document.getElementById('seed-preview');
  const passphrasePreviewEl = document.getElementById('passphrase-preview');
  if (!seedPreviewEl || !passphrasePreviewEl) return;

  const values = readForm();

  updateCardSplitVisibility();
  updateSectionVisibility(values);
  updateGenerateButtonVisibility(values);

  if (hasEmptyRequiredField(values)) {
    renderSeedPreview(seedPreviewEl, null);
    renderPassphrasePreview(passphrasePreviewEl, null);
    return;
  }

  const errors = validate(values);
  if (errors.length > 0) {
    renderSeedPreview(seedPreviewEl, null);
    renderPassphrasePreview(passphrasePreviewEl, null);
    return;
  }

  try {
    // seedParams is only needed for the seed's own preview now - Passphrase's
    // cell size no longer derives from it.
    const seedParams = isSeedSectionActive(values) ? toGeneratorParameters(values) : null;
    const seedLayout = seedParams && values.includeSeedStencil ? computePreviewLayout(seedParams) : null;
    const passphraseParams = isPassphraseSectionActive(values) ? toPassphraseParameters(values) : null;
    const passphraseLayout = passphraseParams && values.passphrase.includeStencil ? computePassphrasePreviewLayout(passphraseParams) : null;
    renderSeedPreview(seedPreviewEl, seedLayout, values.includeSeedStencil ? undefined : STENCIL_UNCHECKED_PLACEHOLDER_TEXT);
    renderPassphrasePreview(passphrasePreviewEl, passphraseLayout, values.passphrase.includeStencil ? undefined : STENCIL_UNCHECKED_PLACEHOLDER_TEXT);
  } catch {
    renderSeedPreview(seedPreviewEl, null);
    renderPassphrasePreview(passphrasePreviewEl, null);
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

// Names the file after the card codes of the stencils/readers in it; the
// reference tables alone carry no code.
function buildFilename(values: FormValues, seed: GeneratorParameters | null, passphrase: PassphraseParameters | null): string {
  const seedIncluded = seed && (values.includeSeedStencil || values.includeSeedReader) ? seed : null;
  const passphraseIncluded = passphrase && (values.passphrase.includeStencil || values.passphrase.includeReader) ? passphrase : null;
  return pdfFilename(seedIncluded, passphraseIncluded);
}

document.getElementById('generator-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = readForm();
  const errors = validate(values);
  renderErrors(errors);
  if (errors.length > 0) return;

  try {
    const seedParams: GeneratorParameters | null = isSeedSectionActive(values) ? toGeneratorParameters(values) : null;
    const passphraseParams = isPassphraseSectionActive(values) ? toPassphraseParameters(values) : null;
    if (passphraseParams && passphraseParams.charsPerBlock <= 0) {
      renderGeneralError('No characters fit on the passphrase card at this cell size. Try a bigger card, smaller cells, or less padding.');
      return;
    }
    const input: StencilInput = {
      seed: seedParams ?? undefined,
      includeSeedStencil: values.includeSeedStencil,
      includeSeedReader: values.includeSeedReader,
      passphrase: passphraseParams ?? undefined,
      includePassphraseStencil: values.passphrase.includeStencil,
      includePassphraseReader: values.passphrase.includeReader,
      includeAsciiTable: values.includeAsciiTable,
      includeSeedWordTable: values.includeSeedWordTable,
    };
    const bytes = await generateStencilPdf(input);
    downloadPdf(bytes, buildFilename(values, seedParams, passphraseParams));
  } catch (error) {
    renderGeneralError(error instanceof Error ? error.message : 'Failed to generate PDF.');
  }
});

// Builds straight from the decoded code, never from the form: the code's own
// version decides the stencil, so later form/default changes can't drift it.
// Always the full recovery kit - stencil, reader and both reference tables -
// since whoever has only the card can't know which pieces they'll need.
function stencilInputFromCode(decoded: DecodedConfigCode): StencilInput {
  const referenceTables = { includeSeedWordTable: true, includeAsciiTable: true };
  if (decoded.kind === 'seed') {
    return { seed: decoded.parameters, includeSeedStencil: true, includeSeedReader: true, ...referenceTables };
  }
  return { passphrase: decoded.parameters, includePassphraseStencil: true, includePassphraseReader: true, ...referenceTables };
}

function showCodeError(message: string | null): void {
  const input = document.getElementById('configCode') as HTMLInputElement;
  const error = document.getElementById('configCode-error') as HTMLElement;
  error.textContent = message ?? '';
  error.classList.toggle('is-hidden', message === null);
  if (message === null) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
}

const codeDialog = document.getElementById('code-dialog') as HTMLDialogElement | null;

function openCodeDialog(code?: string): void {
  const input = document.getElementById('configCode') as HTMLInputElement | null;
  showCodeError(null);
  if (input && code !== undefined) input.value = code;
  codeDialog?.showModal();
  input?.focus();
}

document.getElementById('open-code-dialog')?.addEventListener('click', () => openCodeDialog());

document.getElementById('close-code-dialog')?.addEventListener('click', () => codeDialog?.close());

document.getElementById('code-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = (document.getElementById('configCode') as HTMLInputElement).value;
  if (code.trim() === '') {
    showCodeError('Enter the code printed on your card.');
    return;
  }

  let decoded: DecodedConfigCode;
  try {
    decoded = decodeConfigCode(code);
  } catch (error) {
    showCodeError(error instanceof ConfigCodeError ? error.message : 'Invalid card code.');
    return;
  }
  if (decoded.kind === 'passphrase' && decoded.parameters.charsPerBlock <= 0) {
    showCodeError('No characters fit on a passphrase card with these settings.');
    return;
  }

  try {
    const bytes = await generateStencilPdf(stencilInputFromCode(decoded));
    downloadPdf(
      bytes,
      decoded.kind === 'seed' ? pdfFilename(decoded.parameters, null) : pdfFilename(null, decoded.parameters),
    );
    showCodeError(null);
    codeDialog?.close();
  } catch (error) {
    showCodeError(error instanceof Error ? error.message : 'Failed to generate PDF.');
  }
});

function updateCardDiagram(): void {
  const svg = document.getElementById('card-preview-svg');
  if (!svg) return;
  const positive = (id: string, fallback: number) => {
    const value = (document.getElementById(id) as HTMLInputElement | null)?.valueAsNumber;
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const diagram = cardDiagram(
    positive('cardWidthMm', DEFAULT_FORM_VALUES.cardWidthMm),
    positive('cardHeightMm', DEFAULT_FORM_VALUES.cardHeightMm),
    positive('cardPaddingMm', DEFAULT_FORM_VALUES.cardPaddingMm),
  );
  svg.setAttribute('viewBox', diagram.viewBox);
  svg.setAttribute('aria-label', diagram.label);
  svg.innerHTML = diagram.markup;
}

document.getElementById('generator-form')?.addEventListener('input', () => {
  updatePreview();
  updateCardDiagram();
});
updatePreview();
updateCardDiagram();

const linkedCode = codeFromSearch(location.search);
if (linkedCode) openCodeDialog(linkedCode);

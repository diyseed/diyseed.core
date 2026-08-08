import { generateWriterPdf } from './generator/writer';
import { validate, toGeneratorParameters, DEFAULT_FORM_VALUES, FormValues, FieldError } from './ui/form';
import { EncodingType } from './generator/encoding';
import { computePreviewLayout } from './ui/preview';
import { renderPreview } from './ui/renderPreview';

const FORM_FIELD_IDS: Array<keyof FormValues> = [
  'seedLength',
  'cardCount',
  'cardWidthMm',
  'cardHeightMm',
  'cardSplit',
  'cardPaddingMm',
  'copies',
  'encoding',
];

function readForm(): FormValues {
  const num = (id: string, fallback: number) => {
    const el = document.getElementById(id) as HTMLInputElement;
    const value = Number(el.value);
    return el.value === '' ? fallback : value;
  };
  const encodingEl = document.getElementById('encoding') as HTMLSelectElement;
  const binaryDirectionEl = document.getElementById('binaryDirectionVertical') as HTMLInputElement | null;

  return {
    seedLength: num('seedLength', DEFAULT_FORM_VALUES.seedLength),
    cardCount: num('cardCount', DEFAULT_FORM_VALUES.cardCount),
    cardWidthMm: num('cardWidthMm', DEFAULT_FORM_VALUES.cardWidthMm),
    cardHeightMm: num('cardHeightMm', DEFAULT_FORM_VALUES.cardHeightMm),
    cardSplit: num('cardSplit', DEFAULT_FORM_VALUES.cardSplit),
    cardPaddingMm: num('cardPaddingMm', DEFAULT_FORM_VALUES.cardPaddingMm),
    copies: num('copies', DEFAULT_FORM_VALUES.copies),
    encoding: Number(encodingEl.value) as EncodingType,
    binaryDirection: binaryDirectionEl?.checked ? 'vertical' : 'horizontal',
  };
}

function clearFieldErrors(): void {
  for (const field of FORM_FIELD_IDS) {
    document.getElementById(field)?.removeAttribute('aria-invalid');
    document.getElementById(`${field}-error`)?.remove();
  }
}

function renderErrors(errors: FieldError[]): void {
  const list = document.getElementById('form-errors') as HTMLUListElement;
  list.innerHTML = '';
  clearFieldErrors();

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
  clearFieldErrors();
  const item = document.createElement('li');
  item.textContent = message;
  list.appendChild(item);
}

const REQUIRED_FIELD_IDS = ['seedLength', 'cardCount', 'cardWidthMm', 'cardHeightMm'];

function hasEmptyRequiredField(): boolean {
  return REQUIRED_FIELD_IDS.some((id) => (document.getElementById(id) as HTMLInputElement | null)?.value === '');
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

function updatePreview(): void {
  const previewEl = document.getElementById('preview-panel');
  if (!previewEl) return;

  updateCardSplitVisibility();
  updateBinaryDirectionVisibility();

  if (hasEmptyRequiredField()) {
    renderPreview(previewEl, null);
    return;
  }

  const values = readForm();
  const errors = validate(values);
  if (errors.length > 0) {
    renderPreview(previewEl, null);
    return;
  }

  try {
    const params = toGeneratorParameters(values);
    const layout = computePreviewLayout(params);
    renderPreview(previewEl, layout);
  } catch {
    renderPreview(previewEl, null);
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

document.getElementById('generator-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = readForm();
  const errors = validate(values);
  renderErrors(errors);
  if (errors.length > 0) return;

  try {
    const params = toGeneratorParameters(values);
    const bytes = await generateWriterPdf(params);
    const filename = `hobohodl-${values.seedLength}words-${values.cardCount}cards-${values.cardWidthMm}x${values.cardHeightMm}mm.pdf`;
    downloadPdf(bytes, filename);
  } catch (error) {
    renderGeneralError(error instanceof Error ? error.message : 'Failed to generate PDF.');
  }
});

document.getElementById('generator-form')?.addEventListener('input', updatePreview);
updatePreview();

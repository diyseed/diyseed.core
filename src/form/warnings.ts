import { GeneratorParameters, PassphraseParameters } from '../generator/params';
import * as Config from '../generator/config';

export interface SeedCellWarnings {
  cellTooSmall: boolean;
  cellNotSquare: boolean;
  cellSizeInvalid: boolean;
}

export interface PassphraseWarnings {
  cellTooSmall: boolean;
  noCapacity: boolean;
}

export function seedCellWarnings(params: GeneratorParameters): SeedCellWarnings {
  const { width, height } = params.cellSize;
  const cellSizeInvalid = !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0;
  const cellTooSmall = !cellSizeInvalid && (width < Config.MIN_CELL_SIZE_MM || height < Config.MIN_CELL_SIZE_MM);
  const cellNotSquare =
    !cellSizeInvalid && Math.max(width, height) / Math.min(width, height) > Config.MAX_CELL_ASPECT_RATIO;
  return { cellTooSmall, cellNotSquare, cellSizeInvalid };
}

export function passphraseWarnings(params: PassphraseParameters): PassphraseWarnings {
  const { width, height } = params.cellSize;
  return {
    cellTooSmall: width < Config.MIN_CELL_SIZE_MM || height < Config.MIN_CELL_SIZE_MM,
    noCapacity: params.charsPerBlock <= 0,
  };
}

/* Proprietary and confidential. See LICENSE. */
import logError from './logError.js';

const BEEP_SRC = 'data:audio/wav;base64,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';

function reportError(err) {
  if (typeof logError === 'function') {
    logError(err, { area: 'sound', action: 'playBeep' });
  } else {
    console.warn('[LRP] playBeep failed', err);
  }
}

export function playBeep() {
  try {
    const audio = new Audio(BEEP_SRC);
    audio.volume = 0.6;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => reportError(err));
    }
  } catch (err) {
    reportError(err);
  }
}

export default playBeep;

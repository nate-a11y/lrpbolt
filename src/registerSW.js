import { registerSW } from 'virtual:pwa-register';
import { logError } from "./utils/logError";

registerSW({
  immediate: true,
  onRegisterError(error) {
    logError(error, "registerSW");
  },
});

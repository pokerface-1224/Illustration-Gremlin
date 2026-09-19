import Panel from '@/Panel.vue';
import { App } from 'vue';

const app = createApp(Panel);

<<<<<<< HEAD
=======
const pinia = createPinia();
app.use(pinia);

>>>>>>> 1056dca462a9bece07f703a0a785c149ae580beb
declare module 'vue' {
  interface ComponentCustomProperties {
    t: typeof t;
  }
}
const i18n = {
  install: (app: App) => {
    app.config.globalProperties.t = t;
  },
};
app.use(i18n);

export function initPanel() {
<<<<<<< HEAD
  const $app = $('<div id="troublemaker_forbidden_library">').appendTo('#extensions_settings2');
=======
  const $app = $('<div id="tavern_extension_example">').appendTo('#extensions_settings2');
>>>>>>> 1056dca462a9bece07f703a0a785c149ae580beb
  app.mount($app[0]);
}

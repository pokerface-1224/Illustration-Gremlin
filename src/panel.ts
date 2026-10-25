import Panel from '@/Panel.vue';
import { App } from 'vue';

const app = createApp(Panel);

<<<<<<< HEAD
=======
const pinia = createPinia();
app.use(pinia);

>>>>>>> 2af7a7a77b2fe69fd9a6e41d758b5a3437f4a64e
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
>>>>>>> 2af7a7a77b2fe69fd9a6e41d758b5a3437f4a64e
  app.mount($app[0]);
}

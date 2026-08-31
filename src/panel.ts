import Panel from '@/Panel.vue';
import { App } from 'vue';

const app = createApp(Panel);

<<<<<<< HEAD
=======
const pinia = createPinia();
app.use(pinia);

>>>>>>> ab902309b708d7a7f3ccc6c4fd5c2f5d672fe5e4
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
>>>>>>> ab902309b708d7a7f3ccc6c4fd5c2f5d672fe5e4
  app.mount($app[0]);
}

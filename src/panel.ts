import Panel from '@/Panel.vue';
import { App } from 'vue';

const app = createApp(Panel);

<<<<<<< HEAD
=======
const pinia = createPinia();
app.use(pinia);

>>>>>>> f4129ea60a6332c92c6d17819aca0a1b420d99dd
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
>>>>>>> f4129ea60a6332c92c6d17819aca0a1b420d99dd
  app.mount($app[0]);
}

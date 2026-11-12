import { createApp } from 'vue'
// Served with the app and not from a CDN: the icons have to work without internet
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import '@fortawesome/fontawesome-free/css/regular.min.css'
import './style.scss'
import './theme'
import App from './App.vue'
import i18n from './i18n'
import router from './router'
import { startOfflineSupport } from './offline/pwa'

createApp(App).use(i18n).use(router).mount('#app')
startOfflineSupport()

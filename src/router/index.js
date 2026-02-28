import { createRouter, createWebHashHistory } from 'vue-router'
import Hosts from '../components/Hosts.vue'
import Help from '../components/Help.vue'

const router = createRouter({
    routes: [
        {
            path: '/',
            name: 'home',
            component: Hosts
        },
        {
            path: '/help',
            name: 'help',
            component: Help
        }
    ],
    history: createWebHashHistory()
})

export default router

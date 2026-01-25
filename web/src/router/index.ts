import { createRouter, createWebHistory } from "vue-router";
import AiChatPage from "../pages/AiChatPage.vue";
import ConfigPage from "../pages/ConfigPage.vue";
import MonitorPage from "../pages/MonitorPage.vue";

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			name: "monitor",
			component: MonitorPage,
		},
		{
			path: "/config",
			name: "config",
			component: ConfigPage,
		},
		{
			path: "/ai-chat",
			name: "ai-chat",
			component: AiChatPage,
		},
	],
});

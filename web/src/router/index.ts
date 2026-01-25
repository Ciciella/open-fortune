import { createRouter, createWebHistory } from "vue-router";
import MonitorPage from "../pages/MonitorPage.vue";

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			name: "monitor",
			component: MonitorPage,
		},
	],
});

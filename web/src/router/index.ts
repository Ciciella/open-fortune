import { createRouter, createWebHistory } from "vue-router";
import AiChatPage from "../pages/AiChatPage.vue";
import AgentTeamsPage from "../pages/AgentTeamsPage.vue";
import AssetPage from "../pages/AssetPage.vue";
import ConfigPage from "../pages/ConfigPage.vue";
import DocsPage from "../pages/DocsPage.vue";
import HomePage from "../pages/HomePage.vue";
import MonitorPage from "../pages/MonitorPage.vue";

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			name: "home",
			component: HomePage,
		},
		{
			path: "/trade",
			name: "monitor",
			component: MonitorPage,
		},
		{
			path: "/assets",
			name: "assets",
			component: AssetPage,
		},
		{
			path: "/agent-teams",
			name: "agent-teams",
			component: AgentTeamsPage,
		},
		{
			path: "/config",
			name: "config",
			component: ConfigPage,
		},
		{
			path: "/docs",
			name: "docs",
			component: DocsPage,
		},
		{
			path: "/ai-chat",
			name: "ai-chat",
			component: AiChatPage,
		},
	],
});

<template>
  <div class="toast-container">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.type}`">
      <div class="toast-icon">{{ iconFor(toast.type) }}</div>
      <div class="toast-content">
        <div class="toast-title">{{ toast.title }}</div>
        <div class="toast-message">{{ toast.message }}</div>
      </div>
      <button class="toast-close" @click="remove(toast.id)">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
	id: string;
	title: string;
	message: string;
	type: ToastType;
}

const props = defineProps<{ toasts: ToastItem[] }>();
const emit = defineEmits<(e: "remove", id: string) => void>();

const iconFor = (type: ToastType) => {
	const icons: Record<ToastType, string> = {
		success: "✓",
		error: "✕",
		warning: "⚠",
		info: "ℹ",
	};

	return icons[type] ?? icons.info;
};

const remove = (id: string) => {
	emit("remove", id);
};
</script>

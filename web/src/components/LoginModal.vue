<template>
  <div class="modal" :class="{ show: modelValue }" @click="onBackdrop">
    <div class="modal-content">
      <div class="modal-header">
        <h3>输入平仓密码</h3>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body">
        <input
          v-model="password"
          type="password"
          class="password-input"
          placeholder="请输入平仓密码"
          @keyup.enter="confirm"
        />
        <p class="modal-hint">请输入环境变量 CLOSE_POSITION_PASSWORD 配置的密码</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="close">取消</button>
        <button class="btn-confirm" @click="confirm">确认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
	(e: "update:modelValue", value: boolean): void;
	(e: "confirm", value: string): void;
}>();

const password = ref("");

watch(
	() => props.modelValue,
	(value) => {
		if (value) {
			password.value = "";
		}
	},
);

const close = () => {
	emit("update:modelValue", false);
};

const confirm = () => {
	const trimmed = password.value.trim();
	if (!trimmed) {
		return;
	}

	emit("confirm", trimmed);
	emit("update:modelValue", false);
};

const onBackdrop = (event: MouseEvent) => {
	if (event.target === event.currentTarget) {
		close();
	}
};
</script>

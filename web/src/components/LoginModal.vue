<template>
  <el-dialog v-model="visible" title="输入平仓密码" width="360px" @close="close">
    <el-input
      v-model="password"
      type="password"
      placeholder="请输入平仓密码"
      show-password
      @keyup.enter="confirm"
    />
    <el-text size="small" type="info" class="hint">
      请输入环境变量 CLOSE_POSITION_PASSWORD 配置的密码
    </el-text>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="confirm">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
	(e: "update:modelValue", value: boolean): void;
	(e: "confirm", value: string): void;
}>();

const password = ref("");
const visible = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value),
});

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
</script>

<style scoped>
.hint {
  display: inline-block;
  margin-top: 12px;
}
</style>

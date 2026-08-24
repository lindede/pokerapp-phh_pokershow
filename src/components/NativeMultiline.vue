<script lang="ts">
import { defineComponent, h, nextTick, ref, watch } from "vue";

/** H5 原生 pre / textarea，避开 uni-app 组件的滚动和字数限制。 */
export default defineComponent({
  name: "NativeMultiline",
  props: {
    modelValue: { type: String, default: "" },
    editing: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
  },
  emits: ["update:modelValue", "start-edit"],
  setup(props, { emit }) {
    const ta = ref<HTMLTextAreaElement | null>(null);

    const fit = () => {
      const el = ta.value;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    };

    const setTa = (el: Element | null) => {
      ta.value = (el as HTMLTextAreaElement) || null;
      if (el) {
        nextTick(() => {
          fit();
          ta.value?.focus();
        });
      }
    };

    watch(
      () => [props.editing, props.modelValue] as const,
      () => nextTick(fit)
    );

    return () => {
      if (!props.editing) {
        return h(
          "pre",
          { class: "nl-pre", onClick: () => emit("start-edit") },
          props.modelValue || props.placeholder || " "
        );
      }
      return h("textarea", {
        class: "nl-ta",
        value: props.modelValue,
        placeholder: props.placeholder,
        ref: setTa,
        onInput: (e: Event) => {
          emit(
            "update:modelValue",
            (e.target as HTMLTextAreaElement).value
          );
          requestAnimationFrame(fit);
        },
      });
    };
  },
});
</script>

<style>
.nl-pre,
.nl-ta {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px;
  border: 1px solid #2a3b50;
  border-radius: 6px;
  background: #0e1622;
  color: #d7e6f2;
  font: 12px/1.5 ui-monospace, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.nl-pre {
  cursor: text;
  min-height: 48px;
}
.nl-ta {
  min-height: 120px;
  resize: none;
  overflow: hidden;
  outline: 1px solid #3d8f68;
}
</style>

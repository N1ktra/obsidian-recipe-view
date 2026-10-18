<script lang="ts">
	import Fraction from "fraction.js";
	import { onMount } from "svelte";

	export let baseServings = 1;
	export let scaleNum: number | null = baseServings;
	export let scale: Fraction = new Fraction(1);

	let inputEl: HTMLInputElement;

	$: safeBase = baseServings && baseServings > 0 ? baseServings : 1;
	$: safeScaleNum =
		scaleNum !== null &&
		scaleNum !== undefined &&
		!isNaN(scaleNum) &&
		scaleNum > 0
			? scaleNum
			: safeBase;
	$: scale = new Fraction(safeScaleNum).div(safeBase);

	onMount(() => {
		const initialVal = String(scaleNum ?? safeBase);
		if (inputEl) {
			inputEl.value = initialVal;
			inputEl.setAttribute("value", initialVal);
		}
	});

	$: if (inputEl && scaleNum !== null && scaleNum !== undefined && !isNaN(scaleNum)) {
		const strVal = String(scaleNum);
		if (document.activeElement !== inputEl && inputEl.value !== strVal) {
			inputEl.value = strVal;
		}
		inputEl.setAttribute("value", strVal);
	}

	function handleBlur() {
		if (scaleNum === null || scaleNum === undefined || isNaN(scaleNum) || scaleNum <= 0) {
			scaleNum = safeBase;
		}
		if (inputEl) {
			inputEl.value = String(scaleNum);
			inputEl.setAttribute("value", String(scaleNum));
		}
	}

	function handleFocus(e: FocusEvent) {
		const target = e.currentTarget as HTMLInputElement | null;
		target?.select();
	}
</script>

<div class="scale-selector">
	<label class="scale-label">
		<span class="scale-text">Scale recipe</span>
		<span class="scale-input-wrapper">
			<span class="scale-prefix" aria-hidden="true">×</span>
			<input
				bind:this={inputEl}
				class="scale-input"
				type="number"
				inputmode="decimal"
				min="0"
				step="any"
				on:blur={handleBlur}
				on:focus={handleFocus}
				bind:value={scaleNum}
			/>
		</span>
	</label>
</div>

<style>
	.scale-selector {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: var(--font-smaller);
		background-color: var(--background-secondary);
		padding: var(--size-4-2);
		margin-block-end: var(--size-4-4);
		border-radius: var(--radius-s);
		color: var(--text-muted);
	}

	.scale-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-2);
		margin: 0;
	}

	.scale-input-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.scale-prefix {
		position: absolute;
		left: var(--size-4-2);
		color: var(--text-accent);
		pointer-events: none;
		line-height: 1;
		z-index: 1;
	}

	input.scale-input {
		width: var(--size-4-16, 64px) !important;
		height: var(--size-4-8, 32px) !important;
		min-height: 0 !important;
		padding: 0 var(--size-4-2) 0 var(--size-4-6) !important;
		margin: 0 !important;
		border: none !important;
		border-radius: var(--radius-s, 4px);
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			var(--selected-step-alpha)
		) !important;
		color: var(--text-normal) !important;
		-webkit-text-fill-color: var(--text-normal) !important;
		opacity: 1 !important;
		text-align: right !important;
		font-size: var(--font-smaller) !important;
		line-height: var(--size-4-8, 32px) !important;
		box-sizing: border-box !important;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	input.scale-input::-webkit-outer-spin-button,
	input.scale-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>

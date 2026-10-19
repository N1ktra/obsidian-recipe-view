<script lang="ts">
	import Fraction from "fraction.js";
	import { afterUpdate, onMount } from "svelte";

	export let baseServings = 1;
	export let scaleNum = 1;
	export let scale: Fraction = new Fraction(1);

	let inputEl: HTMLInputElement;

	const MIN_SCALE = 0.25;

	$: safeBase = baseServings && baseServings > 0 ? baseServings : 1;
	$: safeScaleNum =
		scaleNum !== null &&
		scaleNum !== undefined &&
		!isNaN(scaleNum) &&
		scaleNum > 0
			? scaleNum
			: safeBase;
	$: scale = new Fraction(safeScaleNum).div(safeBase);

	let displayValue = String(
		scaleNum !== null && scaleNum !== undefined && !isNaN(scaleNum) && scaleNum > 0
			? scaleNum
			: baseServings && baseServings > 0
			? baseServings
			: 1
	);

	// Keep displayValue synchronized whenever safeScaleNum changes externally
	$: {
		const nextStr = String(safeScaleNum);
		if (!inputEl || document.activeElement !== inputEl) {
			displayValue = nextStr;
		}
	}

	function forceSyncDom() {
		if (!inputEl) return;
		const strVal = String(safeScaleNum);
		if (document.activeElement !== inputEl) {
			displayValue = strVal;
			inputEl.value = strVal;
		}
		inputEl.setAttribute("value", strVal);
		inputEl.defaultValue = strVal;
	}

	onMount(() => {
		forceSyncDom();
	});

	afterUpdate(() => {
		if (inputEl && document.activeElement !== inputEl && !inputEl.value) {
			forceSyncDom();
		}
	});

	function handleInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		displayValue = raw;
		const parsed = parseFloat(raw.replace(",", "."));
		if (!isNaN(parsed) && parsed > 0) {
			scaleNum = parsed;
		}
	}

	function increment(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const current = safeScaleNum;
		if (current < 0.5) {
			scaleNum = 0.5;
		} else if (current < 1) {
			scaleNum = 1;
		} else {
			scaleNum = Number((current + 1).toFixed(2));
		}
		displayValue = String(scaleNum);
		if (inputEl) {
			inputEl.value = displayValue;
			inputEl.setAttribute("value", displayValue);
		}
	}

	function decrement(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const current = safeScaleNum;
		if (current > 1) {
			const next = Number((current - 1).toFixed(2));
			scaleNum = next >= 0.5 ? next : 0.5;
		} else if (current > 0.5) {
			scaleNum = 0.5;
		} else {
			scaleNum = MIN_SCALE;
		}
		displayValue = String(scaleNum);
		if (inputEl) {
			inputEl.value = displayValue;
			inputEl.setAttribute("value", displayValue);
		}
	}

	function handleBlur() {
		const parsed = parseFloat(String(displayValue).replace(",", "."));
		if (isNaN(parsed) || parsed <= 0) {
			scaleNum = safeBase;
		} else {
			scaleNum = parsed;
		}
		displayValue = String(scaleNum);
		if (inputEl) {
			inputEl.value = displayValue;
			inputEl.setAttribute("value", displayValue);
		}
	}

	function handleFocus(e: FocusEvent) {
		const target = e.currentTarget as HTMLInputElement | null;
		target?.select();
	}
</script>

<div class="scale-selector">
	<span class="scale-text">Scale recipe</span>
	<div class="scale-stepper" role="group" aria-label="Scale recipe">
		<button
			type="button"
			class="scale-step-btn scale-step-minus"
			aria-label="Decrease scale"
			disabled={safeScaleNum <= MIN_SCALE}
			on:click={decrement}
		>
			−
		</button>
		<input
			bind:this={inputEl}
			class="scale-input"
			type="text"
			inputmode="decimal"
			aria-label="Recipe scale value"
			bind:value={displayValue}
			on:input={handleInput}
			on:blur={handleBlur}
			on:focus={handleFocus}
		/>
		<button
			type="button"
			class="scale-step-btn scale-step-plus"
			aria-label="Increase scale"
			on:click={increment}
		>
			+
		</button>
	</div>
</div>

<style>
	.scale-selector {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--size-4-3);
		font-size: var(--font-smaller);
		background-color: var(--background-secondary);
		padding: var(--size-4-2) var(--size-4-3);
		margin-block-end: var(--size-4-4);
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		box-sizing: border-box;
	}

	.scale-text {
		font-weight: 500;
		color: var(--text-normal);
		user-select: none;
	}

	.scale-stepper {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background-color: var(--background-primary);
		overflow: hidden;
	}

	button.scale-step-btn {
		min-width: 34px !important;
		height: 32px !important;
		padding: 0 var(--size-4-2) !important;
		margin: 0 !important;
		border: none !important;
		border-radius: 0 !important;
		box-shadow: none !important;
		background-color: transparent !important;
		color: var(--text-normal) !important;
		font-size: var(--font-ui-medium, 15px) !important;
		font-weight: 600 !important;
		line-height: 1 !important;
		display: inline-flex !important;
		align-items: center !important;
		justify-content: center !important;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition: background-color 0.12s ease, color 0.12s ease, transform 0.08s ease;
	}

	button.scale-step-btn:hover:not(:disabled) {
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			0.18
		) !important;
		color: var(--interactive-accent) !important;
	}

	button.scale-step-btn:active:not(:disabled) {
		background-color: var(--interactive-accent) !important;
		color: var(--text-on-accent) !important;
		transform: scale(0.96);
	}

	button.scale-step-btn:disabled {
		opacity: 0.35 !important;
		cursor: not-allowed;
	}

	input.scale-input {
		width: 52px !important;
		height: 32px !important;
		min-height: 0 !important;
		padding: 0 var(--size-4-1) !important;
		margin: 0 !important;
		border: none !important;
		border-inline: 1px solid var(--background-modifier-border) !important;
		border-radius: 0 !important;
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			0.12
		) !important;
		color: var(--text-normal) !important;
		-webkit-text-fill-color: var(--text-normal) !important;
		opacity: 1 !important;
		text-align: center !important;
		font-size: var(--font-smaller) !important;
		font-weight: 600 !important;
		line-height: normal !important;
		box-sizing: border-box !important;
	}

	input.scale-input:focus {
		outline: none !important;
		box-shadow: inset 0 0 0 1px var(--interactive-accent) !important;
	}
</style>

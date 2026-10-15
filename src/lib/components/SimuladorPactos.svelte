<script lang="ts">
	import { getResultados23j, type Nacional } from '#lib/data';

	const CANDIDATOS = {
		pp: {
			nombre: 'Alberto Núñez Feijóo',
			siglas: 'PP',
			color: '#0557A1',
			foto: 'https://s3transparentia.dev.newtral.es/politicians/alberto-nunez-feijoo-1885a09f92c3655d0e74a06bb10a1a39.jpg'
		},
		psoe: {
			nombre: 'Pedro Sánchez',
			siglas: 'PSOE',
			color: '#E10819',
			foto: 'https://s3transparentia.dev.newtral.es/politicians/pedro-sanchez-perez-castejon-041eb7ebe4a18bf30eac11087132165d.jpg'
		}
	};

	type Bloque = 'pp' | 'psoe' | null;

	let nacional = $state<Nacional | null>(null);

	// Solo puede haber un candidato a presidente a la vez. Los aliados (todos menos
	// PP y PSOE, que son el propio candidato) se eligen una vez hay presidente elegido.
	let presidente = $state<Bloque>(null);
	let aliados = $state<Set<string>>(new Set());

	$effect(() => {
		getResultados23j().then((d) => {
			nacional = d.nacional;
			presidente = null;
			aliados = new Set();
		});
	});

	function seleccionarPresidente(cual: 'psoe' | 'pp') {
		presidente = presidente === cual ? null : cual;
		aliados = new Set();
	}

	function toggle(siglas: string) {
		if (siglas === 'PP') {
			seleccionarPresidente('pp');
			return;
		}
		if (siglas === 'PSOE') {
			seleccionarPresidente('psoe');
			return;
		}
		if (!presidente) return;
		const next = new Set(aliados);
		if (next.has(siglas)) {
			next.delete(siglas);
		} else {
			next.add(siglas);
		}
		aliados = next;
	}

	function reiniciar() {
		presidente = null;
		aliados = new Set();
	}

	let escanosPsoePropio = $derived(nacional?.partidos.find((p) => p.siglas === 'PSOE')?.escanos ?? 0);
	let escanosPpPropio = $derived(nacional?.partidos.find((p) => p.siglas === 'PP')?.escanos ?? 0);

	let seatsPsoe = $derived(
		presidente === 'psoe' && nacional
			? escanosPsoePropio + nacional.partidos.filter((p) => aliados.has(p.siglas)).reduce((s, p) => s + p.escanos, 0)
			: 0
	);
	let seatsPp = $derived(
		presidente === 'pp' && nacional
			? escanosPpPropio + nacional.partidos.filter((p) => aliados.has(p.siglas)).reduce((s, p) => s + p.escanos, 0)
			: 0
	);

	let aliadosPsoe = $derived(presidente === 'psoe' && nacional ? nacional.partidos.filter((p) => aliados.has(p.siglas)) : []);
	let aliadosPp = $derived(presidente === 'pp' && nacional ? nacional.partidos.filter((p) => aliados.has(p.siglas)) : []);

	// PSOE crece desde la izquierda, PP desde la derecha — solo uno de los dos
	// grupos tendrá contenido nunca, porque solo puede haber un presidente activo.
	let segsPsoe = $derived.by(() => {
		if (!nacional || presidente !== 'psoe') return [];
		const propio = nacional.partidos.find((p) => p.siglas === 'PSOE')!;
		const resto = nacional.partidos.filter((p) => aliados.has(p.siglas)).sort((a, b) => b.escanos - a.escanos);
		return [propio, ...resto];
	});
	let segsPp = $derived.by(() => {
		if (!nacional || presidente !== 'pp') return [];
		const propio = nacional.partidos.find((p) => p.siglas === 'PP')!;
		const resto = nacional.partidos.filter((p) => aliados.has(p.siglas)).sort((a, b) => a.escanos - b.escanos);
		return [...resto, propio];
	});
	let pctLibre = $derived(nacional ? 100 - ((seatsPsoe + seatsPp) / nacional.totalEscanos) * 100 : 100);
	let mayoriaPct = $derived(nacional ? (nacional.mayoria / nacional.totalEscanos) * 100 : 0);
</script>

{#if !nacional}
	<p class="loading">Cargando datos…</p>
{:else}
	<div class="simulador">
		<div class="candidatos">
			<button
				type="button"
				class="candidato candidato-psoe"
				class:gana={seatsPsoe >= nacional.mayoria}
				class:activo={presidente === 'psoe'}
				onclick={() => toggle('PSOE')}
			>
				<span class="avatar" style="border-color:{CANDIDATOS.psoe.color}">
					<img src={CANDIDATOS.psoe.foto} alt={CANDIDATOS.psoe.nombre} class="avatar-img" />
				</span>
				<span class="candidato-nombre">{CANDIDATOS.psoe.nombre}</span>
				<span class="candidato-partido">PSOE</span>
				<span class="candidato-count">{seatsPsoe}<span class="candidato-total">/{nacional.mayoria}</span></span>
				<span class="candidato-status">
					{#if seatsPsoe >= nacional.mayoria}
						Suma mayoría
					{:else if presidente === 'psoe'}
						Faltan {nacional.mayoria - seatsPsoe}
					{:else}
						Toca para empezar
					{/if}
				</span>
				{#if aliadosPsoe.length}
					<span class="candidato-aliados">{aliadosPsoe.map((p) => p.siglas).join(' | ')}</span>
				{/if}
			</button>

			<div class="versus">
				<span class="versus-vs">VS</span>
				<button class="reset" onclick={reiniciar}>Reiniciar pactos</button>
			</div>

			<button
				type="button"
				class="candidato candidato-pp"
				class:gana={seatsPp >= nacional.mayoria}
				class:activo={presidente === 'pp'}
				onclick={() => toggle('PP')}
			>
				<span class="avatar" style="border-color:{CANDIDATOS.pp.color}">
					<img src={CANDIDATOS.pp.foto} alt={CANDIDATOS.pp.nombre} class="avatar-img" />
				</span>
				<span class="candidato-nombre">{CANDIDATOS.pp.nombre}</span>
				<span class="candidato-partido">PP</span>
				<span class="candidato-count">{seatsPp}<span class="candidato-total">/{nacional.mayoria}</span></span>
				<span class="candidato-status">
					{#if seatsPp >= nacional.mayoria}
						Suma mayoría
					{:else if presidente === 'pp'}
						Faltan {nacional.mayoria - seatsPp}
					{:else}
						Toca para empezar
					{/if}
				</span>
				{#if aliadosPp.length}
					<span class="candidato-aliados">{aliadosPp.map((p) => p.siglas).join(' | ')}</span>
				{/if}
			</button>
		</div>

		<div class="barra-wrap">
			<div class="barra-track">
				{#each segsPsoe as p (p.siglas)}
					{@const pct = (p.escanos / nacional.totalEscanos) * 100}
					<div class="barra-seg asig-psoe" style="width:{pct}%; --seg-color:{p.color}">
						{#if pct >= 4}<span class="barra-seg-label">{p.escanos}</span>{/if}
					</div>
				{/each}
				<div class="barra-libre" style="width:{pctLibre}%"></div>
				{#each segsPp as p (p.siglas)}
					{@const pct = (p.escanos / nacional.totalEscanos) * 100}
					<div class="barra-seg asig-pp" style="width:{pct}%; --seg-color:{p.color}">
						{#if pct >= 4}<span class="barra-seg-label">{p.escanos}</span>{/if}
					</div>
				{/each}
			</div>
			<div class="maj-marker" style="left:{mayoriaPct}%">
				<span class="maj-text">Mayoría<br /><b>{nacional.mayoria}</b></span>
				<span class="maj-line"></span>
			</div>
		</div>

		<p class="instrucciones">Elige primero un presidente y después toca los partidos para sumarlos o quitarlos de su pacto.</p>

		<ul class="legend">
			{#each nacional.partidos as p (p.siglas)}
				{@const esPropio = p.siglas === 'PP' || p.siglas === 'PSOE'}
				{@const sumado = esPropio ? (p.siglas === 'PP' ? presidente === 'pp' : presidente === 'psoe') : aliados.has(p.siglas)}
				<li>
					<button
						class="chip"
						class:chip-pp={sumado && presidente === 'pp'}
						class:chip-psoe={sumado && presidente === 'psoe'}
						class:chip-disabled={!esPropio && !presidente}
						onclick={() => toggle(p.siglas)}
					>
						<span class="chip-swatch" style="background:{p.color}"></span>
						<span class="chip-name">{p.siglas}</span>
						<span class="chip-seats">{p.escanos}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 40px 0;
		text-align: center;
	}

	.simulador {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}

	.candidatos {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		width: 100%;
		max-width: 760px;
	}

	.candidato {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		background: var(--paper);
		border: 1px solid var(--border);
		padding: 20px 16px;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.candidato:hover {
		background: #fafafa;
	}

	.candidato:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.candidato-psoe.activo {
		border-color: #E10819;
	}

	.candidato-pp.activo {
		border-color: #0557A1;
	}

	.candidato.gana {
		background: #f3fbf8;
	}

	.candidato-pp.gana {
		border-color: #0557A1;
		border-width: 2px;
	}

	.candidato-psoe.gana {
		border-color: #E10819;
		border-width: 2px;
	}

	.avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid;
		margin-bottom: 4px;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.candidato-nombre {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		color: var(--ink);
		text-align: center;
	}

	.candidato-partido {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
	}

	.candidato-count {
		font-family: var(--font-mono);
		font-size: 28px;
		font-weight: 700;
		color: var(--ink);
		margin-top: 4px;
	}

	.candidato-total {
		font-size: 14px;
		font-weight: 500;
		color: var(--grey);
	}

	.candidato-status {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		color: var(--grey);
	}

	.candidato.gana .candidato-status {
		color: #0a7a4a;
	}

	.candidato-aliados {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--grey);
		text-align: center;
		max-width: 180px;
	}

	.versus {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.versus-vs {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 800;
		color: var(--grey);
	}

	.reset {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--grey);
		background: none;
		border: 1px solid var(--border);
		padding: 6px 10px;
		cursor: pointer;
		white-space: nowrap;
	}

	.reset:hover {
		color: var(--ink);
		border-color: var(--ink);
	}

	.instrucciones {
		font-family: var(--font-body);
		font-size: 12px;
		font-style: italic;
		color: var(--grey);
		text-align: center;
		max-width: 56ch;
		margin: 0;
	}

	.barra-wrap {
		position: relative;
		width: 100%;
		max-width: 680px;
		padding-top: 30px;
	}

	.barra-track {
		display: flex;
		width: 100%;
		height: 34px;
		background: #f0f0f0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		overflow: hidden;
	}

	.barra-seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: var(--seg-color);
		border-right: 1px solid rgba(255, 255, 255, 0.5);
		border-bottom: 4px solid transparent;
		transition: width 0.25s ease;
	}

	.barra-seg:last-child {
		border-right: none;
	}

	.barra-seg.asig-psoe {
		border-bottom-color: #E10819;
	}

	.barra-seg.asig-pp {
		border-bottom-color: #0557A1;
	}

	.barra-seg-label {
		color: #fff;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
	}

	.barra-libre {
		height: 100%;
		background: repeating-linear-gradient(135deg, #e5e7eb, #e5e7eb 4px, #ededed 4px, #ededed 8px);
		transition: width 0.25s ease;
	}

	.maj-marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.maj-text {
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ink);
		text-align: center;
		line-height: 1.1;
		margin-bottom: 8px;
	}

	.maj-text b {
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.maj-line {
		width: 1px;
		height: 34px;
		background: var(--ink);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
		max-width: 680px;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: inherit;
		background: var(--paper);
		border: 1px solid var(--border);
		padding: 6px 10px;
		cursor: pointer;
	}

	.chip:hover {
		border-color: var(--ink);
	}

	.chip-swatch {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	.chip-name {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		color: var(--ink);
	}

	.chip-seats {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--grey);
	}

	.chip-pp {
		border-color: #0557A1;
		background: rgba(5, 87, 161, 0.08);
	}

	.chip-psoe {
		border-color: #E10819;
		background: rgba(225, 8, 25, 0.08);
	}

	.chip-disabled {
		opacity: 0.4;
	}

	@media (max-width: 640px) {
		.candidatos {
			grid-template-columns: 1fr 1fr;
			gap: 10px;
		}

		.versus {
			grid-column: 1 / -1;
			order: 3;
			margin-top: 4px;
		}

		.versus-vs {
			display: none;
		}

		.candidato {
			padding: 14px 10px;
		}

		.avatar {
			width: 44px;
			height: 44px;
		}

		.candidato-count {
			font-size: 22px;
		}

		.candidato-aliados {
			display: none;
		}
	}
</style>

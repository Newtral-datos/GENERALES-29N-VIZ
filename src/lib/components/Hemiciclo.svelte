<script lang="ts">
	import { getResultados23j, type Nacional, type Partido } from '#lib/data';

	let nacional = $state<Nacional | null>(null);

	$effect(() => {
		getResultados23j().then((d) => {
			nacional = d.nacional;
		});
	});

	const deg2rad = (d: number) => (d * Math.PI) / 180;
	const polar = (cx: number, cy: number, r: number, a: number) => ({
		x: cx + r * Math.cos(deg2rad(a)),
		y: cy - r * Math.sin(deg2rad(a))
	});

	const arcPath = (cx: number, cy: number, ri: number, ro: number, a0: number, a1: number) => {
		const os = polar(cx, cy, ro, a0);
		const oe = polar(cx, cy, ro, a1);
		const ie = polar(cx, cy, ri, a1);
		const is_ = polar(cx, cy, ri, a0);
		const la = Math.abs(a1 - a0) > 180 ? 1 : 0;
		const sw = a1 > a0 ? 0 : 1;
		return [
			'M', os.x, os.y,
			'A', ro, ro, 0, la, sw, oe.x, oe.y,
			'L', ie.x, ie.y,
			'A', ri, ri, 0, la, sw ? 0 : 1, is_.x, is_.y,
			'Z'
		].join(' ');
	};

	const cx = 200,
		cy = 200,
		oR = 180,
		iR = 132;

	// Anillo interior: comparativa con la elección anterior (datos simulados, ver JSON).
	const oR2 = 116,
		iR2 = 72;

	const buildSegments = (
		items: Partido[],
		getSeats: (p: Partido) => number,
		total: number,
		ri: number,
		ro: number,
		prefix: string
	) => {
		const left = items.filter((p) => p.lado === 1).sort((a, b) => getSeats(b) - getSeats(a));
		const right = items.filter((p) => p.lado === 2).sort((a, b) => getSeats(a) - getSeats(b));
		const seq = [...left, ...right];
		let acc = 0;
		return seq.map((p, i) => {
			const seats = getSeats(p);
			const a0 = 180 - (acc / total) * 180;
			const a1 = 180 - ((acc + seats) / total) * 180;
			acc += seats;
			const lp = polar(cx, cy, (ri + ro) / 2, (a0 + a1) / 2);
			return { ...p, seats, path: arcPath(cx, cy, ri, ro, a0, a1), lx: lp.x, ly: lp.y, key: `${prefix}${i}` };
		});
	};

	let majAngle = $derived(nacional ? 180 - (nacional.mayoria / nacional.totalEscanos) * 180 : 180);
	let majStart = $derived(polar(cx, cy, iR2 - 10, majAngle));
	let majEnd = $derived(polar(cx, cy, oR + 10, majAngle));

	let segments = $derived(
		nacional ? buildSegments(nacional.partidos, (p) => p.escanos, nacional.totalEscanos, iR, oR, 'cur') : []
	);
	let segmentsAnterior = $derived(
		nacional
			? buildSegments(nacional.partidos, (p) => p.escanosAnterior, nacional.anterior.totalEscanos, iR2, oR2, 'ant')
			: []
	);
</script>

<div class="card">
	<div class="card-header">
		<span class="teal-bar"></span>
		<span class="card-label">Distribución de escaños — Congreso</span>
	</div>

	<div class="card-body">
		{#if !nacional}
			<p class="loading">Cargando datos…</p>
		{:else}
		<svg viewBox="0 0 400 240" class="hemiciclo">
			<defs>
				<filter id="seg-glow">
					<feGaussianBlur stdDeviation="2" result="blur" />
					<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
				</filter>
				<linearGradient id="maj-grad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stop-color="#0d1117" stop-opacity="0.9" />
					<stop offset="100%" stop-color="#0d1117" stop-opacity="0.2" />
				</linearGradient>
			</defs>

			<path d={arcPath(cx, cy, iR, oR, 180, 0)} fill="#f1f5f9" />
			<path d={arcPath(cx, cy, iR2, oR2, 180, 0)} fill="#f1f5f9" />

			{#each segments as s (s.key)}
				<g filter="url(#seg-glow)">
					<path d={s.path} fill={s.color} stroke="rgba(255,255,255,0.5)" stroke-width="1.5" />
					{#if s.seats >= 10}
						<text x={s.lx} y={s.ly} text-anchor="middle" dominant-baseline="middle" class="seg-label">
							{s.seats}
						</text>
					{/if}
				</g>
			{/each}

			{#each segmentsAnterior as s (s.key)}
				<g>
					<path d={s.path} fill={s.color} fill-opacity="0.55" stroke="#fff" stroke-width="1" />
					{#if s.seats >= 15}
						<text x={s.lx} y={s.ly} text-anchor="middle" dominant-baseline="middle" class="seg-label-sm">
							{s.seats}
						</text>
					{/if}
				</g>
			{/each}

			<line
				x1={majStart.x}
				y1={majStart.y}
				x2={majEnd.x}
				y2={majEnd.y}
				stroke="url(#maj-grad)"
				stroke-width="2"
				stroke-dasharray="5,3"
			/>

			<text x={cx} y={cy - 18} text-anchor="middle" class="centre-label">Mayoría</text>
			<text x={cx} y={cy + 6} text-anchor="middle" class="centre-number">{nacional.mayoria}</text>
			<text x={cx} y={cy + 24} text-anchor="middle" class="centre-label">escaños</text>

			<text x={cx - oR + 16} y={cy + 20} text-anchor="middle" class="pole-label">2023</text>
			<text x={cx + oR - 16} y={cy + 20} text-anchor="middle" class="pole-label">2023</text>
			<text x={cx - oR2 + 14} y={cy + 16} text-anchor="middle" class="pole-label-sm">Ant.</text>
			<text x={cx + oR2 - 14} y={cy + 16} text-anchor="middle" class="pole-label-sm">Ant.</text>
		</svg>

		<p class="nota-anterior">Anillo interior: elección anterior (datos simulados)</p>

		<div class="legend">
			{#each nacional.partidos as p (p.siglas)}
				<div class="chip">
					<span class="dot" style="background:{p.color}"></span>
					<span class="chip-name">{p.siglas}</span>
					<span class="chip-value">{p.escanos}</span>
				</div>
			{/each}
		</div>

		<div class="tabla-scroll">
			<table class="tabla">
				<thead>
					<tr>
						<th class="th-left">Partido</th>
						<th>Votos</th>
						<th>%</th>
						<th>Escaños</th>
						<th>Dif.</th>
					</tr>
				</thead>
				<tbody>
					{#each nacional.partidos as p (p.siglas)}
						{@const dif = p.escanos - p.escanosAnterior}
						<tr>
							<td>
								<div class="party-cell">
									<span class="dot" style="background:{p.color}"></span>
									<span class="party-name">{p.siglas}</span>
								</div>
							</td>
							<td class="num">{p.votos.toLocaleString('es-ES')}</td>
							<td class="num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
							<td class="num seats">{p.escanos}</td>
							<td class="num">
								<span class="dif" class:up={dif > 0} class:down={dif < 0}>
									{dif > 0 ? '+' : ''}{dif}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{/if}
	</div>
</div>

<style>
	.card {
		background: #fff;
		border: 1px solid #e5e7eb;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-width: 0;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 18px;
		background: #fafafa;
		border-bottom: 1px solid #f0f0f0;
		flex-shrink: 0;
	}

	.teal-bar {
		display: inline-block;
		width: 3px;
		height: 14px;
		border-radius: 2px;
		background: var(--c);
		flex-shrink: 0;
	}

	.card-label {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--grey);
		flex: 1;
		text-align: center;
	}

	.card-body {
		padding: 16px;
		flex: 1;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.hemiciclo {
		width: 100%;
		max-width: 360px;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: 'Instrument Sans', system-ui;
		padding: 40px 0;
	}

	.seg-label {
		fill: #fff;
		font-size: 15px;
		font-weight: 700;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.centre-label {
		fill: var(--grey);
		font-size: 11px;
		font-family: 'Instrument Sans', system-ui;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.centre-number {
		fill: var(--cd);
		font-size: 26px;
		font-weight: 500;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.seg-label-sm {
		fill: #fff;
		font-size: 11px;
		font-weight: 700;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.pole-label {
		fill: var(--ink);
		font-size: 13px;
		font-weight: 700;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.pole-label-sm {
		fill: var(--grey);
		font-size: 10px;
		font-weight: 600;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.nota-anterior {
		font-size: 10px;
		color: var(--grey);
		font-style: italic;
		margin: 2px 0 4px 0;
		text-align: center;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin-top: 8px;
		margin-bottom: 12px;
		width: 100%;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		border-radius: 5px;
		border: 1px solid #f3f4f6;
		background: #f8fafc;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chip-name {
		font-size: 11px;
		color: #6b7280;
		font-family: 'Instrument Sans', system-ui;
	}

	.chip-value {
		font-size: 11px;
		font-weight: 700;
		color: var(--ink);
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.tabla-scroll {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.tabla {
		width: 100%;
		min-width: 360px;
		border-collapse: collapse;
	}

	.tabla thead tr {
		border-bottom: 1px solid #e5e7eb;
	}

	.tabla th {
		padding: 5px 6px;
		text-align: center;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--grey);
		font-family: 'Instrument Sans', system-ui;
	}

	.tabla th.th-left {
		text-align: left;
	}

	.tabla tbody tr {
		border-bottom: 1px solid #f3f4f6;
	}

	.tabla td {
		padding: 5px 6px;
	}

	.party-cell {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.party-name {
		font-size: 12px;
		font-weight: 500;
		color: #374151;
		font-family: 'Instrument Sans', system-ui;
	}

	.num {
		text-align: center;
		font-size: 12px;
		color: #9ca3af;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.num.seats {
		font-size: 13px;
		font-weight: 600;
		color: var(--cd);
	}

	.dif {
		display: inline-flex;
		align-items: center;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 700;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		background: #f8fafc;
		color: #9ca3af;
	}

	.dif.up {
		background: #ecfdf5;
		color: #059669;
	}

	.dif.down {
		background: #fef2f2;
		color: #dc2626;
	}

	@media (max-width: 640px) {
		.card-header {
			padding: 10px 14px;
		}

		.card-body {
			padding: 14px 10px;
		}

		.tabla {
			min-width: 0;
		}

		.tabla th {
			padding: 4px 3px;
			font-size: 9px;
		}

		.tabla td {
			padding: 4px 3px;
		}

		.party-name {
			font-size: 11px;
		}

		.num {
			font-size: 11px;
		}

		.num.seats {
			font-size: 12px;
		}

		.dif {
			padding: 1px 4px;
			font-size: 10px;
		}
	}
</style>

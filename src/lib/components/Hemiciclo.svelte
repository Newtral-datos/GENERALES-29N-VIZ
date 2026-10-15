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
	let majStart = $derived(polar(cx, cy, iR2 - 14, majAngle));
	let majEnd = $derived(polar(cx, cy, oR + 14, majAngle));

	let segments = $derived(
		nacional ? buildSegments(nacional.partidos, (p) => p.escanos, nacional.totalEscanos, iR, oR, 'cur') : []
	);
	let segmentsAnterior = $derived(
		nacional
			? buildSegments(nacional.partidos, (p) => p.escanosAnterior, nacional.anterior.totalEscanos, iR2, oR2, 'ant')
			: []
	);
</script>

<div class="panel">
	<p class="kicker">Distribución de escaños</p>

	<div class="panel-body">
	{#if !nacional}
	<p class="loading">Cargando datos…</p>
	{:else}
	<div class="wrap">
		<svg viewBox="0 0 400 240" class="hemiciclo">
			<defs>
				<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
					<rect width="4" height="4" fill="transparent" />
					<line x1="0" y1="0" x2="0" y2="4" stroke="rgba(10,14,20,0.4)" stroke-width="1" />
				</pattern>
			</defs>

			<path d={arcPath(cx, cy, iR, oR, 180, 0)} fill="none" stroke="var(--border)" stroke-width="1" />
			<path d={arcPath(cx, cy, iR2, oR2, 180, 0)} fill="none" stroke="var(--border)" stroke-width="1" />

			{#each segments as s (s.key)}
				<g>
					<path d={s.path} fill={s.color} stroke="var(--border)" stroke-width="1" />
					{#if s.seats >= 10}
						<text x={s.lx} y={s.ly} text-anchor="middle" dominant-baseline="middle" class="seg-label">
							{s.seats}
						</text>
					{/if}
				</g>
			{/each}

			{#each segmentsAnterior as s (s.key)}
				<g opacity="0.55">
					<path d={s.path} fill={s.color} stroke="var(--border)" stroke-width="0.75" />
					<path d={s.path} fill="url(#hatch)" />
					{#if s.seats >= 15}
						<text x={s.lx} y={s.ly} text-anchor="middle" dominant-baseline="middle" class="seg-label-sm">
							{s.seats}
						</text>
					{/if}
				</g>
			{/each}

			<line x1={majStart.x} y1={majStart.y} x2={majEnd.x} y2={majEnd.y} stroke="var(--ink)" stroke-width="1.5" />
			<circle cx={majStart.x} cy={majStart.y} r="2" fill="var(--ink)" />
			<circle cx={majEnd.x} cy={majEnd.y} r="2" fill="var(--ink)" />

			<text x={cx} y={cy - 18} text-anchor="middle" class="centre-label">Mayoría</text>
			<text x={cx} y={cy + 10} text-anchor="middle" class="centre-number">{nacional.mayoria}</text>
			<text x={cx} y={cy + 26} text-anchor="middle" class="centre-label">escaños</text>

			<text x={cx - oR + 16} y={cy + 20} text-anchor="middle" class="pole-label">2023</text>
			<text x={cx + oR - 16} y={cy + 20} text-anchor="middle" class="pole-label">2023</text>
			<text x={cx - oR2 + 14} y={cy + 16} text-anchor="middle" class="pole-label-sm">ant.</text>
			<text x={cx + oR2 - 14} y={cy + 16} text-anchor="middle" class="pole-label-sm">ant.</text>
		</svg>

		<p class="nota-anterior">Elecciones anteriores</p>

		<ul class="legend">
			{#each nacional.partidos as p (p.siglas)}
				<li class="entry">
					<span class="swatch" style="background:{p.color}"></span>
					<span class="entry-name">{p.siglas}</span>
					<span class="entry-value">{p.escanos}</span>
				</li>
			{/each}
		</ul>
	</div>
	{/if}
	</div>
</div>

<style>
	.panel {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 8px 0;
		text-align: center;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
	}

	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.hemiciclo {
		width: 100%;
		max-width: 420px;
	}

	.seg-label {
		fill: #fff;
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 700;
	}

	.centre-label {
		fill: var(--grey);
		font-family: var(--font-body);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.centre-number {
		fill: var(--ink);
		font-family: var(--font-mono);
		font-size: 28px;
		font-weight: 700;
	}

	.seg-label-sm {
		fill: #fff;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
	}

	.pole-label {
		fill: var(--ink);
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
	}

	.pole-label-sm {
		fill: var(--grey);
		font-family: var(--font-mono);
		font-size: 9px;
	}

	.nota-anterior {
		font-size: 10px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 4px 0 2px 0;
		text-align: center;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 3px 12px;
		margin: 8px 0 12px 0;
		padding: 0;
		list-style: none;
		width: 100%;
	}

	.entry {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}

	.swatch {
		width: 6px;
		height: 6px;
		flex-shrink: 0;
		transform: translateY(1px);
	}

	.entry-name {
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--grey);
	}

	.entry-value {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import MapaMunicipios, { type MunicipioSeleccionado } from '#lib/components/MapaMunicipios.svelte';
	import {
		getResultados23j,
		getEscanosCongresoProvincias,
		getCcaaProvincias,
		type Resultados23J,
		type EscanosProvincia
	} from '#lib/data';

	// Mismo convenio izquierda/derecha que Hemiciclo.svelte y BarraEscanos.svelte.
	const LADO: Record<string, 1 | 2> = {
		PSOE: 1,
		SUMAR: 1,
		ERC: 1,
		'EH Bildu': 1,
		'B.N.G.': 1,
		PP: 2,
		VOX: 2,
		'JxCAT - JUNTS': 2,
		'EAJ-PNV': 2,
		CCa: 2,
		'U.P.N.': 2
	};

	let datos = $state<Resultados23J | null>(null);
	let escanosProvincias = $state<Record<string, EscanosProvincia> | null>(null);
	let ccaaProvincias = $state<Record<string, string> | null>(null);
	let seleccion = $state<string | null>(null);
	let ccaaAbierta = $state<string | null>(null);
	let municipioSeleccionado = $state<MunicipioSeleccionado | null>(null);
	let inicializadoDesdeUrl = false;

	$effect(() => {
		getResultados23j().then((d) => {
			datos = d;
		});
	});

	$effect(() => {
		getEscanosCongresoProvincias().then((d) => {
			escanosProvincias = d;
		});
	});

	$effect(() => {
		getCcaaProvincias().then((d) => {
			ccaaProvincias = d;
		});
	});

	$effect(() => {
		if (inicializadoDesdeUrl || !datos || !ccaaProvincias) return;
		const cod = page.url.searchParams.get('cod');
		if (!cod || !datos.provincias[cod]) return;
		seleccion = cod;
		ccaaAbierta = ccaaProvincias[cod] ?? null;
		inicializadoDesdeUrl = true;
	});

	let provincias = $derived(
		datos
			? Object.entries(datos.provincias)
					.map(([cod, p]) => ({ cod, ...p }))
					.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
			: []
	);

	let grupos = $derived.by(() => {
		if (!ccaaProvincias) return [];
		const map = new Map<string, typeof provincias>();
		for (const p of provincias) {
			const ccaa = ccaaProvincias[p.cod] ?? 'Otras';
			if (!map.has(ccaa)) map.set(ccaa, []);
			map.get(ccaa)!.push(p);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
	});

	function toggleCcaa(nombre: string) {
		ccaaAbierta = ccaaAbierta === nombre ? null : nombre;
	}

	let activa = $derived(seleccion && datos ? datos.provincias[seleccion] : null);

	let escanosTotalActiva = $derived(
		seleccion && escanosProvincias ? escanosProvincias[seleccion]?.escanos ?? null : null
	);

	let barraSegments = $derived.by(() => {
		if (!activa) return [];
		const conEscanos = activa.principales.filter((p) => p.escanos > 0);
		const total = conEscanos.reduce((acc, p) => acc + p.escanos, 0);
		const left = conEscanos.filter((p) => LADO[p.siglas] !== 2).sort((a, b) => b.escanos - a.escanos);
		const right = conEscanos.filter((p) => LADO[p.siglas] === 2).sort((a, b) => a.escanos - b.escanos);
		return [...left, ...right].map((p) => ({ ...p, pct: total ? (p.escanos / total) * 100 : 0 }));
	});

	function volverAProvincia() {
		municipioSeleccionado = null;
		if (page.url.searchParams.has('muni')) {
			const params = new URLSearchParams(page.url.searchParams);
			params.delete('muni');
			replaceState(`${page.url.pathname}?${params.toString()}`, page.state);
		}
	}
</script>

<div class="panel">
	{#if !datos || !ccaaProvincias}
		<p class="loading">Cargando datos…</p>
	{:else}
		<div class="layout">
			<div class="lista-wrap">
				<p class="sub-kicker">Comunidades autónomas</p>
				<ul class="lista-ccaa">
					{#each grupos as [ccaa, provs] (ccaa)}
						<li>
							<button
								type="button"
								class="ccaa-btn"
								class:open={ccaaAbierta === ccaa}
								onclick={() => toggleCcaa(ccaa)}
							>
								<span class="chevron" class:open={ccaaAbierta === ccaa}>▸</span>
								<span class="ccaa-nombre">{ccaa}</span>
								<span class="ccaa-count">{provs.length}</span>
							</button>
							{#if ccaaAbierta === ccaa}
								<ul class="lista-provs">
									{#each provs as p (p.cod)}
										<li>
											<button
												type="button"
												class="prov-btn"
												class:active={seleccion === p.cod}
												onclick={() => (seleccion = p.cod)}
											>
												<span class="swatch" style="background:{p.ganador.color}"></span>
												<span class="prov-nombre">{p.nombre}</span>
												<span class="prov-ganador">{p.ganador.siglas}</span>
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<div class="detalle">
				{#if !activa}
					<p class="placeholder">Selecciona una provincia de la lista para ver sus resultados.</p>
				{:else if municipioSeleccionado}
					<button type="button" class="volver-muni" onclick={volverAProvincia}>
						← Volver a {activa.nombre}
					</button>

					<p class="sub-kicker">{municipioSeleccionado.nombre}</p>

					{#if municipioSeleccionado.resultado}
						{@const r = municipioSeleccionado.resultado}
						<ul class="stats">
							<li><span class="stat-label">Censo</span><span class="stat-value">{r.censo.toLocaleString('es-ES')}</span></li>
							<li><span class="stat-label">Mesas</span><span class="stat-value">{r.mesas.toLocaleString('es-ES')}</span></li>
							<li><span class="stat-label">Votantes</span><span class="stat-value">{r.votantes.toLocaleString('es-ES')}</span></li>
							<li><span class="stat-label">Participación</span><span class="stat-value">{r.participacionPct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</span></li>
							<li><span class="stat-label">Válidos</span><span class="stat-value">{r.validos.toLocaleString('es-ES')}</span></li>
							<li><span class="stat-label">Blanco</span><span class="stat-value">{r.blanco.toLocaleString('es-ES')}</span></li>
							<li><span class="stat-label">Nulos</span><span class="stat-value">{r.nulos.toLocaleString('es-ES')}</span></li>
						</ul>

						<div class="tabla-scroll">
							<table class="tabla">
								<thead>
									<tr>
										<th class="th-left">Partido</th>
										<th>Votos</th>
										<th>%</th>
									</tr>
								</thead>
								<tbody>
									{#each r.principales as p (p.siglas)}
										<tr>
											<td>
												<div class="party-cell">
													<span class="swatch" style="background:{p.color}"></span>
													<span class="party-name">{p.siglas}</span>
												</div>
											</td>
											<td class="num">{p.votos.toLocaleString('es-ES')}</td>
											<td class="num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
										</tr>
									{/each}
									{#if r.otros.numCandidaturas > 0}
										<tr class="fila-otros">
											<td>
												<div class="party-cell">
													<span class="swatch swatch-otros"></span>
													<span class="party-name">Otros ({r.otros.numCandidaturas})</span>
												</div>
											</td>
											<td class="num">{r.otros.votos.toLocaleString('es-ES')}</td>
											<td class="num">{r.otros.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
						<p class="nota">Resultados del municipio — 23J</p>
					{:else}
						<p class="placeholder">Sin datos para este municipio.</p>
					{/if}
				{:else}
					<p class="sub-kicker">
						{activa.nombre}{#if escanosTotalActiva !== null}
							<span class="prov-total-escanos"> · {escanosTotalActiva} diputados</span>
						{/if}
					</p>

					<div class="barra-wrap">
						<div class="barra">
							{#each barraSegments as s (s.siglas)}
								<div class="seg" style="width:{s.pct}%; background:{s.color}" title="{s.nombre}: {s.escanos} escaños">
									{#if s.pct >= 12}
										<span class="seg-label">{s.escanos}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<div class="tabla-scroll">
						<table class="tabla">
							<thead>
								<tr>
									<th class="th-left">Partido</th>
									<th>Votos</th>
									<th>%</th>
									<th>Escaños</th>
								</tr>
							</thead>
							<tbody>
								{#each activa.principales as p (p.siglas)}
									<tr>
										<td>
											<div class="party-cell">
												<span class="swatch" style="background:{p.color}"></span>
												<span class="party-name">{p.siglas}</span>
											</div>
										</td>
										<td class="num">{p.votos.toLocaleString('es-ES')}</td>
										<td class="num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
										<td class="num seats">{p.escanos}</td>
									</tr>
								{/each}
								{#if activa.otros.numCandidaturas > 0}
									<tr class="fila-otros">
										<td>
											<div class="party-cell">
												<span class="swatch swatch-otros"></span>
												<span class="party-name">Otros ({activa.otros.numCandidaturas})</span>
											</div>
										</td>
										<td class="num">{activa.otros.votos.toLocaleString('es-ES')}</td>
										<td class="num">{activa.otros.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
										<td class="num seats">—</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
					<p class="nota">Candidaturas con representación y principales minoritarias — 23J</p>
				{/if}

				{#if activa}
					<div class="mapa-municipal">
						{#key seleccion}
							<MapaMunicipios cod={seleccion!} bind:seleccionado={municipioSeleccionado} />
						{/key}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.panel {
		width: 100%;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
		text-align: center;
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 20px;
	}

	.sub-kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 8px 0;
	}

	.prov-total-escanos {
		font-weight: 400;
		color: var(--grey);
	}

	.volver-muni {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--paper);
		border: 1.5px solid var(--ink);
		padding: 7px 12px;
		margin: 0 0 12px 0;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ink);
		cursor: pointer;
		transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease, color 0.15s ease;
	}

	.volver-muni:hover {
		background: var(--ink);
		color: var(--paper);
		box-shadow: var(--shadow-hard-lift);
		transform: translate(-2px, -2px);
	}

	.stats {
		list-style: none;
		margin: 0 0 12px 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px 16px;
	}

	.stats li {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		font-family: var(--font-body);
		font-size: 12px;
	}

	.stat-label {
		color: var(--grey);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.lista-wrap {
		border: 1px solid var(--border);
		padding: 12px;
	}

	.lista-ccaa {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 420px;
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr;
		gap: 2px;
	}

	.ccaa-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 8px;
		background: none;
		border: 1px solid transparent;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		text-align: left;
	}

	.ccaa-btn:hover {
		background: #fafafa;
	}

	.ccaa-btn.open {
		background: #fafafa;
		border-color: var(--border);
	}

	.chevron {
		display: inline-block;
		font-size: 9px;
		color: var(--grey);
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.ccaa-nombre {
		flex: 1;
		min-width: 0;
	}

	.ccaa-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--grey);
	}

	.lista-provs {
		list-style: none;
		margin: 0;
		padding: 2px 0 4px 20px;
		display: grid;
		grid-template-columns: 1fr;
		gap: 2px;
	}

	.prov-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 8px;
		background: none;
		border: 1px solid transparent;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--ink);
		text-align: left;
	}

	.prov-btn:hover {
		background: #fafafa;
	}

	.prov-btn.active {
		border-color: var(--ink);
		background: #fafafa;
	}

	.swatch {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	.prov-nombre {
		flex: 1;
		min-width: 0;
	}

	.prov-ganador {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--grey);
	}

	.detalle {
		border: 1px solid var(--border);
		padding: 16px;
		min-height: 180px;
	}

	.placeholder {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		text-align: center;
		padding: 32px 0;
	}

	.barra-wrap {
		margin: 0 0 14px 0;
	}

	.barra {
		display: flex;
		width: 100%;
		height: 22px;
		overflow: hidden;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		border-right: 1px solid var(--border);
	}

	.seg:last-child {
		border-right: none;
	}

	.seg-label {
		color: #fff;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.tabla-scroll {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-top: 1px solid var(--border);
	}

	.tabla {
		width: 100%;
		min-width: 320px;
		border-collapse: collapse;
	}

	.tabla thead tr {
		border-bottom: 1px solid var(--border);
	}

	.tabla th {
		padding: 4px 6px;
		text-align: center;
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
	}

	.tabla th.th-left {
		text-align: left;
	}

	.tabla tbody tr {
		border-bottom: 1px solid var(--border);
	}

	.tabla tbody tr:hover {
		background: #fafafa;
	}

	.tabla td {
		padding: 5px 6px;
	}

	.fila-otros td {
		color: var(--grey);
	}

	.fila-otros .party-name {
		font-style: italic;
		color: var(--grey);
	}

	.swatch-otros {
		background: repeating-linear-gradient(45deg, #c7cacd, #c7cacd 2px, transparent 2px, transparent 4px);
	}

	.party-cell {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.party-name {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink);
	}

	.num {
		text-align: center;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--grey);
		font-variant-numeric: tabular-nums;
	}

	.num.seats {
		font-size: 12px;
		font-weight: 700;
		color: var(--ink);
	}

	.nota {
		font-size: 9px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 6px 0 0 0;
		text-align: center;
	}

	.mapa-municipal {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	@media (min-width: 720px) {
		.layout {
			grid-template-columns: 1fr 1.4fr;
			align-items: start;
		}
	}
</style>

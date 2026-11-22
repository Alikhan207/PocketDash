export type ForecastPoint = { date: string; balance: number };

type CashForecastChartProps = {
  series?: ForecastPoint[] | null;
  scenarioSeries?: ForecastPoint[] | null;
  shortageDate?: string | null;
  forecastDays?: number;
};

const W = 680;
const H = 270;
const PAD = { top: 12, right: 12, bottom: 35, left: 85 };

function toPath(points: ForecastPoint[], xFor: (i: number) => number, yFor: (v: number) => number): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(Number(p.balance) || 0).toFixed(1)}`)
    .join(' ');
}

function shortLabel(date: string | undefined): string {
  return typeof date === 'string' ? date.slice(0, 10) : '';
}

export default function CashForecastChart(props: CashForecastChartProps) {
  const baseline = Array.isArray(props.series) ? props.series : [];
  const scenario = Array.isArray(props.scenarioSeries) ? props.scenarioSeries : [];
  const forecastDays = props.forecastDays ?? baseline.length;

  if (baseline.length < 2) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        Not enough forecast data to chart yet.
      </div>
    );
  }

  const n = baseline.length;
  const count = scenario.length >= 2 ? Math.min(n, scenario.length) : 0;
  const values = [...baseline, ...scenario].map((p) => Number(p.balance) || 0);
  const min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max === min) max = min + 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xFor = (i: number) => PAD.left + (i / (n - 1)) * plotW;
  const yFor = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const baselinePath = toPath(baseline, xFor, yFor);
  const scenarioPath = count > 0 ? toPath(scenario.slice(0, count), xFor, yFor) : '';

  const shortageKey = shortLabel(props.shortageDate ?? undefined);
  let markerIndex = shortageKey ? baseline.findIndex((p) => shortLabel(p.date) === shortageKey) : -1;
  if (markerIndex === -1 && shortageKey) {
    markerIndex = baseline.findIndex((p) => (Number(p.balance) || 0) < 0);
  }
  const marker =
    markerIndex >= 0
      ? { x: xFor(markerIndex), y: yFor(Number(baseline[markerIndex].balance) || 0) }
      : null;

  return (
    <div data-nexen-component="nx_components_CashForecastChart" className="w-full min-w-0 overflow-x-auto rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium" data-nexen-id="nx-aee85619-0">{forecastDays}-day balance</span>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1" data-nexen-id="nx-aee85619-1">
            <span className="inline-block h-0.5 w-4 bg-primary"  data-nexen-id="nx-aee85619-2"/> Baseline
          </span>
          {count > 0 && (
            <span className="inline-flex items-center gap-1" data-nexen-id="nx-aee85619-3">
              <span className="inline-block h-0.5 w-4 border-t border-dashed border-accent"  data-nexen-id="nx-aee85619-4"/> Scenario
            </span>
          )}
          {marker && (
            <span className="inline-flex items-center gap-1" data-nexen-id="nx-aee85619-5">
              <span className="inline-block h-2 w-2 rounded-full bg-destructive"  data-nexen-id="nx-aee85619-6"/> Shortage
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[440px]"
        role="img"
        aria-label={`Cash balance over ${forecastDays} days`}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yFor(0)}
          y2={yFor(0)}
          className="stroke-border"
          strokeWidth={1}
        />
        <text x={4} y={PAD.top + 8} className="fill-muted-foreground" fontSize={14}>
          ₹{Math.round(max).toLocaleString('en-IN')}
        </text>
        <text x={4} y={H - PAD.bottom} className="fill-muted-foreground" fontSize={14}>
          ₹{Math.round(min).toLocaleString('en-IN')}
        </text>
        <text x={PAD.left} y={H - 6} className="fill-muted-foreground" fontSize={14}>
          {shortLabel(baseline[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted-foreground" fontSize={14}>
          {shortLabel(baseline[n - 1].date)}
        </text>

        <path d={baselinePath} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />
        {scenarioPath && (
          <path
            d={scenarioPath}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        )}
        {marker && (
          <g>
            <line
              x1={marker.x}
              x2={marker.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-destructive"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle cx={marker.x} cy={marker.y} r={4} className="fill-destructive" />
          </g>
        )}
      </svg>
    </div>
  );
}
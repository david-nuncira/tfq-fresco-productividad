// Gráficas con Recharts (biblioteca gratuita y estable).

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { fmtFecha } from '../lib/formato'
import type { PuntoDia } from '../lib/tipos'

const AZUL = '#1d5c8f'
const VERDE = '#2e7d4f'
const ROJO = '#b3443c'

export function GraficaEvolucionDiaria({ datos }: { datos: PuntoDia[] }) {
  const serie = [...datos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  return (
    <div className="grafica" style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde4ea" />
          <XAxis dataKey="fecha" tickFormatter={(v: unknown) => fmtFecha(String(v)).slice(0, 5)} fontSize={12} />
          <YAxis fontSize={12} allowDecimals={false} />
          <Tooltip
            labelFormatter={(v: unknown) => 'Fecha: ' + fmtFecha(String(v))}
            formatter={(valor: unknown, nombre: unknown) => [Number(valor).toLocaleString('es-CO'), String(nombre)]}
          />
          <Line type="monotone" dataKey="bandejas" name="Bandejas" stroke={AZUL} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficaCabezasDiaria({ datos }: { datos: PuntoDia[] }) {
  const serie = [...datos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  return (
    <div className="grafica" style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde4ea" />
          <XAxis dataKey="fecha" tickFormatter={(v: unknown) => fmtFecha(String(v)).slice(0, 5)} fontSize={12} />
          <YAxis fontSize={12} allowDecimals={false} />
          <Tooltip
            labelFormatter={(v: unknown) => 'Fecha: ' + fmtFecha(String(v))}
            formatter={(valor: unknown, nombre: unknown) => [Number(valor).toLocaleString('es-CO'), String(nombre)]}
          />
          <Legend />
          <Bar dataKey="conformes" name="Cabezas conformes" stackId="c" fill={VERDE} />
          <Bar dataKey="no_conformes" name="Cabezas no conformes" stackId="c" fill={ROJO} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface BarraOperarioDato {
  etiqueta: string
  valor: number
}

export function GraficaBarrasOperarios({ datos, nombreSerie }: { datos: BarraOperarioDato[]; nombreSerie: string }) {
  const alto = Math.max(200, datos.length * 34 + 60)
  return (
    <div className="grafica" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 24, bottom: 4, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde4ea" />
          <XAxis type="number" fontSize={12} allowDecimals={false} />
          <YAxis type="category" dataKey="etiqueta" width={170} fontSize={12} />
          <Tooltip formatter={(valor: unknown) => [Number(valor).toLocaleString('es-CO'), nombreSerie]} />
          <Bar dataKey="valor" name={nombreSerie} fill={AZUL} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

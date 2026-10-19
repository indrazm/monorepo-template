// Re-export the Recharts primitives through @repo/ui so apps can compose charts
// without taking a direct dependency on recharts (it lives here, alongside the
// ChartContainer wrapper in ./chart).
export {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

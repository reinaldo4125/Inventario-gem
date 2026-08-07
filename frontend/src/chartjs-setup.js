import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// Set a conservative upper bound for ticks to avoid Chart.js warnings when ranges are huge.
const SAFE_MAX_TICKS = 1000;
if (ChartJS && ChartJS.defaults && ChartJS.defaults.scales) {
	ChartJS.defaults.scales.linear = ChartJS.defaults.scales.linear || {};
	ChartJS.defaults.scales.linear.ticks = ChartJS.defaults.scales.linear.ticks || {};
	ChartJS.defaults.scales.linear.ticks.maxTicksLimit = SAFE_MAX_TICKS;
}

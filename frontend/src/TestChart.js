import React from 'react';
import { Bar } from 'react-chartjs-2';

import './chartjs-setup';

const labels = ['A', 'B', 'C'];
const values = [1, 2, 3];
const data = {
  labels,
  datasets: [{ label: 'Test', data: values, backgroundColor: ['#3182ce', '#38a169', '#d69e2e'] }]
};
const options = { responsive: true };

export default function TestChart() {
  return <Bar key={`test-${labels.join('|')}-${values.join('|')}`} data={data} options={options} />;
}

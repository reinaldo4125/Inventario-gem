import React from 'react';
import { render, screen } from '@testing-library/react';
import Login from '../Login';

test('renders login form', () => {
  render(<Login />);
  const input = screen.getByPlaceholderText(/Correo/i);
  expect(input).toBeInTheDocument();
});

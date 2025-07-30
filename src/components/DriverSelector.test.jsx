import { render, screen, fireEvent } from '@testing-library/react';
import DriverSelector from './DriverSelector';

const noop = () => {};

describe('DriverSelector', () => {
  it('renders a dropdown of drivers', () => {
    const drivers = ['Alice', 'Bob'];
    render(
      <DriverSelector driver="" setDriver={noop} drivers={drivers} isTracking={false} role="Admin" />
    );
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
  });
});

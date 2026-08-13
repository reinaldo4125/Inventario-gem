import React from 'react';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    try {
      // Log helpful context: component props and stack
      console.error('ChartErrorBoundary caught error:', error);
      console.error('Chart props:', this.props);
      console.error('Error info:', info);
    } catch (e) {
      console.error('Error logging failed', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{color:'red',padding:12,border:'1px solid #fca5a5',borderRadius:8,background:'#fff7f7'}}>
          <strong>Error en la gráfica</strong>
          <div style={{fontSize:12,marginTop:8}}>{String(this.state.error && this.state.error.message)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChartErrorBoundary;

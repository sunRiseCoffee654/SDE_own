import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Orbit application tree:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            backgroundColor: '#f8fafc',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: 480,
              width: '100%',
              p: 4,
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              backgroundColor: '#ffffff',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <AlertTriangle size={28} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3, lineHeight: 1.6 }}>
              Orbit encountered an unexpected issue while rendering. Your data is safe in local storage and cloud.
            </Typography>

            {this.state.error && (
              <Box
                component="details"
                sx={{
                  mb: 3,
                  textAlign: 'left',
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: '#f1f5f9',
                  fontSize: 12,
                  color: '#475569',
                  overflow: 'auto',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error details</summary>
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.message}
                </pre>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={this.handleReload}
                startIcon={<RotateCcw size={16} />}
                sx={{ borderRadius: 2 }}
              >
                Reload App
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={this.handleReset}
                sx={{ borderRadius: 2 }}
              >
                Reset workspace
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}


import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ForwardingStep } from '../types/tron';
import { CheckCircle, Circle, AlertCircle, Clock } from 'lucide-react';

interface ForwardingStepsProps {
  steps: ForwardingStep[];
}

export const ForwardingSteps = ({ steps }: ForwardingStepsProps) => {
  if (steps.length === 0) {
    return (
      <Card className="bg-gradient-secondary border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Circle className="h-5 w-5 text-muted-foreground" />
            Forwarding Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Circle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Waiting for incoming TRX to trigger forwarding process...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStepIcon = (status: ForwardingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'active':
        return <Clock className="h-5 w-5 text-primary animate-pulse-glow" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStepEmoji = (stepId: string) => {
    const emojis: Record<string, string> = {
      detect: '🎯',
      create: '📝',
      sign1: '✍️',
      sign2: '✍️',
      broadcast: '📡',
      confirm: '✅'
    };
    return emojis[stepId] || '📝';
  };

  const getStatusBadge = (status: ForwardingStep['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success text-success-foreground">Completed</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-primary text-primary-foreground animate-pulse-glow">Processing</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className="bg-gradient-secondary border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Multisig Forwarding Process
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`flex items-center gap-4 p-3 rounded-lg border transition-all duration-300 ${
                step.status === 'active' 
                  ? 'border-primary bg-primary/5 animate-cyber-pulse' 
                  : step.status === 'completed'
                  ? 'border-success/30 bg-success/5'
                  : step.status === 'error'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border'
              }`}
            >
              {/* Step Number & Icon */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  step.status === 'completed' 
                    ? 'border-success bg-success/20 text-success'
                    : step.status === 'active'
                    ? 'border-primary bg-primary/20 text-primary'
                    : step.status === 'error'
                    ? 'border-destructive bg-destructive/20 text-destructive'
                    : 'border-muted bg-muted/20 text-muted-foreground'
                }`}>
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                <span className="text-lg">{getStepEmoji(step.id)}</span>
              </div>

              {/* Step Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{step.label}</h4>
                  {getStatusBadge(step.status)}
                </div>
                
                {step.details && (
                  <p className="text-sm text-muted-foreground">{step.details}</p>
                )}
                
                {step.timestamp && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Status Icon */}
              <div className="flex-shrink-0">
                {getStepIcon(step.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
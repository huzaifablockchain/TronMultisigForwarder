import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Play, Square, RefreshCw, AlertTriangle, Shield } from 'lucide-react';
import { useTronLink } from '../hooks/useTronLink';
import { useForwarder } from '../hooks/useForwarder';



export const ControlPanel = () => {
  const { isConnected, connect, approvingAddress } = useTronLink();
  const { 
    isRunning, 
    multisigStatus, 
    config,
    startMonitoring, 
    stopMonitoring,
    updateReceivingBalance 
  } = useForwarder();

  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    await startMonitoring();
    setIsStarting(false);
  };

  const handleStop = () => {
    stopMonitoring();
  };

  const canStart = isConnected && config && multisigStatus.isConfigured;
  
  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge className="bg-success text-success-foreground animate-pulse-glow">
          <Play className="h-3 w-3 mr-1" />
          MONITORING ACTIVE
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Square className="h-3 w-3 mr-1" />
        STOPPED
      </Badge>
    );
  };

  const getWarnings = () => {
    const warnings = [];
    
    if (!config) {
      warnings.push('Environment configuration missing');
    }
    
    if (!isConnected) {
      warnings.push('TronLink wallet not connected');
    }
    
    if (!multisigStatus.isConfigured) {
      warnings.push('2-of-2 multisig not configured on receiving wallet');
    }
    
    return warnings;
  };

  const warnings = getWarnings();

  return (
    <Card className="bg-gradient-secondary border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Control Panel
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">TronLink Status</div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Badge variant="default" className="bg-success text-success-foreground">
                    Connected
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {approvingAddress.slice(0, 6)}...{approvingAddress.slice(-4)}
                  </span>
                </>
              ) : (
                <Badge variant="destructive">Not Connected</Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Multisig Status</div>
            <div className="flex items-center gap-2">
              {multisigStatus.isConfigured ? (
                <Badge variant="default" className="bg-success text-success-foreground">
                  {multisigStatus.threshold}-of-{multisigStatus.keyCount}
                </Badge>
              ) : (
                <Badge variant="destructive">Not Configured</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isConnected && (
            <Button 
              onClick={connect} 
              variant="outline" 
              className="w-full"
            >
              Connect TronLink Wallet
            </Button>
          )}

          <div className="flex gap-3">
            {!isRunning ? (
              <Button 
                onClick={handleStart}
                disabled={!canStart || isStarting}
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              >
                {isStarting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Monitoring
              </Button>
            ) : (
              <Button 
                onClick={handleStop}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Monitoring
              </Button>
            )}

            <Button 
              onClick={updateReceivingBalance}
              variant="outline"
              size="icon"
              disabled={!config}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium text-warning">Setup Required:</div>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success State */}
        {canStart && !isRunning && (
          <Alert className="border-success/50 bg-success/10">
            <Shield className="h-4 w-4 text-success" />
            <AlertDescription>
              <div className="font-medium text-success">
                Ready to start! All systems configured properly.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Active Monitoring State */}
        {isRunning && (
          <Alert className="border-primary/50 bg-primary/10">
            <Play className="h-4 w-4 text-primary animate-pulse-glow" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium text-primary">Auto-forwarder is monitoring!</div>
                <div className="text-sm">
                  Watching for incoming TRX payments to trigger 2-of-2 multisig forwarding.
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
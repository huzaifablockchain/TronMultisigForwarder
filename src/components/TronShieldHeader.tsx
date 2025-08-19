// import { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useTronLink } from '../hooks/useTronLink';
import { useForwarder } from '../hooks/useForwarder';
import { Shield, Wallet, Network, Zap, AlertTriangle } from 'lucide-react';

export const TronShieldHeader = () => {
  const { 
    isAvailable, 
    isConnected, 
    isConnecting, 
    approvingAddress, 
    approvingBalance,
    connect,
    tronWeb
  } = useTronLink();
  
  const { receivingBalance, config, multisigStatus } = useForwarder();

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: number) => {
    if (!tronWeb) return '0';
    const trxAmount = tronWeb.fromSun(balance);
    return Number(trxAmount).toFixed(4);
  };

  const getNetworkName = (url: string) => {
    if (url.includes('shasta')) return 'Shasta Testnet';
    if (url.includes('api.trongrid.io')) return 'Mainnet';
    return 'Custom Network';
  };

  const getMultisigStatusIcon = () => {
    if (multisigStatus.isConfigured) return '✅';
    if (multisigStatus.threshold > 0) return '⚠️';
    return '❌';
  };

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-6 py-4">
        {/* Title Section */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary animate-pulse-glow" />
            <div>
              <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
                TRON Multisig Forwarder
              </h1>
              <p className="text-sm text-muted-foreground">
                Multisig Auto-Forwarder • TronLink Hybrid
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="animate-cyber-pulse">
              <Zap className="h-3 w-3 mr-1" />
              2-of-2 Multisig
            </Badge>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Network Status */}
          <Card className="p-4 bg-gradient-secondary border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Network</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {config ? getNetworkName(config.tronFullHost) : 'Not Connected'}
            </div>
            <Badge 
              variant={config ? "default" : "destructive"} 
              className="mt-2 text-xs"
            >
              {config ? 'Connected' : 'Disconnected'}
            </Badge>
          </Card>

          {/* Receiving Wallet */}
          <Card className="p-4 bg-gradient-secondary border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Receiving Wallet</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {config ? formatAddress(config.receivingAddress) : 'Not Configured'}
            </div>
            <div className="text-lg font-bold text-accent mt-1">
              {formatBalance(receivingBalance)} TRX
            </div>
          </Card>

          {/* Approving Wallet */}
          <Card className="p-4 bg-gradient-secondary border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">Approving Wallet</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {isConnected ? formatAddress(approvingAddress) : 'Not Connected'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {isConnected ? (
                <Badge variant="default" className="text-xs">
                  {formatBalance(approvingBalance)} TRX
                </Badge>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={connect}
                  disabled={!isAvailable || isConnecting}
                  className="text-xs h-6"
                >
                  {!isAvailable 
                    ? 'Install TronLink' 
                    : isConnecting 
                    ? 'Connecting...' 
                    : 'Connect'
                  }
                </Button>
              )}
            </div>
          </Card>

          {/* Multisig Status */}
          <Card className="p-4 bg-gradient-secondary border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">Multisig Status</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getMultisigStatusIcon()}</span>
              <div className="text-xs">
                <div className="text-muted-foreground">
                  {multisigStatus.threshold}/{multisigStatus.keyCount} Required
                </div>
                <Badge 
                  variant={multisigStatus.isConfigured ? "default" : "destructive"}
                  className="text-xs mt-1"
                >
                  {multisigStatus.isConfigured ? 'Configured' : 'Setup Required'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Warnings */}
        {(!isConnected || !multisigStatus.isConfigured) && (
          <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Setup Required</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {!isConnected && "Connect TronLink wallet to enable approving functionality. "}
              {!multisigStatus.isConfigured && "Configure 2-of-2 multisig permissions on receiving wallet."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
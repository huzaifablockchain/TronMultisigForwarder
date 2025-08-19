import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Settings, MapPin, Clock, DollarSign, Globe } from 'lucide-react';

interface ConfigPanelProps {
  config?: {
    receivingAddress: string;
    destinationAddress: string;
    feeReserve: number;
    pollInterval: number;
    tronFullHost: string;
  };
}

export const ConfigPanel = ({ config }: ConfigPanelProps) => {
  const formatAddress = (address: string) => {
    if (!address) return 'Not configured';
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  };

  const getNetworkBadge = (url: string) => {
    if (url.includes('shasta')) {
      return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">Testnet</Badge>;
    }
    if (url.includes('api.trongrid.io')) {
      return <Badge variant="outline" className="bg-success/20 text-success border-success/30">Mainnet</Badge>;
    }
    return <Badge variant="outline">Custom</Badge>;
  };

  if (!config) {
    return (
      <Card className="bg-gradient-secondary border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Configuration not loaded. Check environment variables.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-secondary border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Network Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Network</Label>
            {getNetworkBadge(config.tronFullHost)}
          </div>
          <Input
            value={config.tronFullHost}
            readOnly
            className="bg-muted/30 text-sm"
          />
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              <Label className="text-sm font-medium">Receiving Address</Label>
              <Badge variant="outline" className="text-xs bg-accent/20 text-accent border-accent/30">
                ENV Key
              </Badge>
            </div>
            <Input
              value={formatAddress(config.receivingAddress)}
              readOnly
              className="bg-muted/30 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-success" />
              <Label className="text-sm font-medium">Destination Address</Label>
            </div>
            <Input
              value={formatAddress(config.destinationAddress)}
              readOnly
              className="bg-muted/30 text-sm font-mono"
            />
          </div>
        </div>

        {/* Operational Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-warning" />
              <Label className="text-sm font-medium">Fee Reserve</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={config.feeReserve}
                readOnly
                className="bg-muted/30 text-sm"
              />
              <span className="text-xs text-muted-foreground">TRX</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Poll Interval</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={config.pollInterval / 1000}
                readOnly
                className="bg-muted/30 text-sm"
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Receiving wallet auto-signs with ENV private key</p>
            <p>• Approving wallet signs via TronLink extension</p>
            <p>• All transactions require 2-of-2 multisig approval</p>
            <p>• Fee reserve ensures gas for transactions</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
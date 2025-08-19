import { TronShieldHeader } from '../components/TronShieldHeader';
import { ConfigPanel } from '../components/ConfigPanel';
import { ControlPanel } from '../components/ControlPanel';
import { ForwardingSteps } from '../components/ForwardingSteps';
import { ActivityLog } from '../components/ActivityLog';
import { useForwarder } from '../hooks/useForwarder';

const Index = () => {
  const { logs, currentSteps, config, clearLogs } = useForwarder();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <TronShieldHeader />

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Configuration & Controls */}
          <div className="space-y-6">
            <ConfigPanel config={config} />
            <ControlPanel />
          </div>

          {/* Middle Column - Process Flow */}
          <div className="xl:col-span-2 space-y-6">
            <ForwardingSteps steps={currentSteps} />
            <ActivityLog logs={logs} onClearLogs={clearLogs} />
          </div>
        </div>
      </div>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
};

export default Index;

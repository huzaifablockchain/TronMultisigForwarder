import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { LogEntry } from '../types/tron';
import { Trash2, Activity, ChevronDown, ChevronRight } from 'lucide-react';

interface ActivityLogProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const ActivityLog = ({ logs, onClearLogs }: ActivityLogProps) => {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getLogIcon = (level: LogEntry['level']): string => {
    const icons = {
      'INFO': '📋',
      'SUCCESS': '✅',
      'WARNING': '⚠️',
      'ERROR': '❌',
      'DETECTION': '🎯',
      'SIGNATURE': '✍️',
      'BROADCAST': '📡',
      'BALANCE': '💰'
    };
    return icons[level] || '📝';
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'SUCCESS':
        return 'bg-success text-success-foreground';
      case 'ERROR':
        return 'bg-destructive text-destructive-foreground';
      case 'WARNING':
        return 'bg-warning text-warning-foreground';
      case 'DETECTION':
        return 'bg-primary text-primary-foreground';
      case 'SIGNATURE':
        return 'bg-accent text-accent-foreground';
      case 'BROADCAST':
        return 'bg-primary text-primary-foreground';
      case 'BALANCE':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="bg-gradient-secondary border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Activity Log
            <Badge variant="outline" className="ml-2">
              {logs.length}
            </Badge>
          </CardTitle>
          {logs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearLogs}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activity yet. Start monitoring to see logs.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border border-border rounded-lg p-3 bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getLogIcon(log.level)}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          className={`text-xs ${getLevelColor(log.level)}`}
                          variant="secondary"
                        >
                          {log.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-foreground mb-1">
                        {log.message}
                      </p>
                      
                      {log.details && Object.keys(log.details).length > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => toggleLogExpansion(log.id)}
                          >
                            {expandedLogs.has(log.id) ? (
                              <ChevronDown className="h-3 w-3 mr-1" />
                            ) : (
                              <ChevronRight className="h-3 w-3 mr-1" />
                            )}
                            Details
                          </Button>
                          
                          {expandedLogs.has(log.id) && (
                            <div className="mt-2 p-2 bg-muted/30 rounded border-l-2 border-primary/30">
                              <div className="space-y-1">
                                {Object.entries(log.details).map(([key, value]) => (
                                  <div key={key} className="flex justify-between items-start gap-2">
                                    <span className="text-xs font-medium text-muted-foreground min-w-0 flex-shrink-0">
                                      {key}:
                                    </span>
                                    <span className="text-xs text-foreground break-all">
                                      {typeof value === 'object' 
                                        ? JSON.stringify(value) 
                                        : String(value)
                                      }
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
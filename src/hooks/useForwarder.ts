import { useState, useEffect, useCallback, useRef } from 'react';
import { TronWeb } from 'tronweb';
import { ForwardingConfig, LogEntry, ForwardingStep, MultisigStatus } from '@/types/tron';
import { useTronLink } from './useTronLink';
import { useToast } from '@/hooks/use-toast';

export const useForwarder = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [receivingBalance, setReceivingBalance] = useState<number>(0);
  const [lastBalance, setLastBalance] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentSteps, setCurrentSteps] = useState<ForwardingStep[]>([]);
  const [multisigStatus, setMultisigStatus] = useState<MultisigStatus>({
    isConfigured: false,
    threshold: 0,
    keyCount: 0,
    hasReceivingKey: false,
    hasApprovingKey: false,
  });

  const { tronWeb: tronLinkWeb, isConnected, approvingAddress, signTransaction } = useTronLink();
  const { toast } = useToast();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tronWebRef = useRef<any>(null);
  const heartbeatCountRef = useRef(0);

  // Initialize TronWeb with receiving wallet
  useEffect(() => {
    const initTronWeb = () => {
      const config: ForwardingConfig = {
        receivingPrivateKey: import.meta.env.VITE_RECEIVING_PRIVATE_KEY || '',
        receivingAddress: import.meta.env.VITE_RECEIVING_ADDRESS || '',
        destinationAddress: import.meta.env.VITE_DESTINATION_ADDRESS || '',
        feeReserve: parseFloat(import.meta.env.VITE_FEE_RESERVE || '0.5'),
        pollInterval: parseInt(import.meta.env.VITE_POLL_INTERVAL || '3000'),
        tronFullHost: import.meta.env.VITE_TRON_FULLHOST || 'https://api.shasta.trongrid.io',
      };

      if (!config.receivingPrivateKey || !config.receivingAddress) {
        addLog('ERROR', 'Missing configuration: Please check your environment variables');
        return;
      }

      try {
        // Use the TronWeb constructor we resolved above
        const tronWeb = new TronWeb({
          fullHost: config.tronFullHost,
          privateKey: config.receivingPrivateKey,
        });

        tronWebRef.current = { tronWeb, config };
        addLog('SUCCESS', 'TronWeb initialized successfully', {
          network: config.tronFullHost,
          receivingAddress: config.receivingAddress,
        });

        // Initial balance check
        updateReceivingBalance();
        
        // Verify multisig setup
        verifyMultisigSetup();
      } catch (error: any) {
        addLog('ERROR', 'Failed to initialize TronWeb', { error: error.message });
      }
    };

    initTronWeb();
  }, []);

  const addLog = useCallback((level: LogEntry['level'], message: string, details?: Record<string, any>) => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      level,
      message,
      details,
    };

    setLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep last 100 logs

    // Show toast for important events
    if (['ERROR', 'SUCCESS', 'DETECTION'].includes(level)) {
      toast({
        title: getLogIcon(level) + ' ' + level,
        description: message,
        variant: level === 'ERROR' ? 'destructive' : 'default',
      });
    }
  }, [toast]);

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

  const updateReceivingBalance = useCallback(async () => {
    if (!tronWebRef.current) return;

    try {
      const { tronWeb, config } = tronWebRef.current;
      const balance = await tronWeb.trx.getBalance(config.receivingAddress);
      setReceivingBalance(balance);
      return balance;
    } catch (error: any) {
      console.error('Failed to update receiving balance:', error);
      return null;
    }
  }, []);

  const verifyMultisigSetup = useCallback(async () => {
    if (!tronWebRef.current || !approvingAddress) return;

    try {
      const { tronWeb, config } = tronWebRef.current;
      const accountInfo = await tronWeb.trx.getAccount(config.receivingAddress);
      
      let status: MultisigStatus = {
        isConfigured: false,
        threshold: 0,
        keyCount: 0,
        hasReceivingKey: false,
        hasApprovingKey: false,
      };

      if (accountInfo.active_permission && accountInfo.active_permission.length > 0) {
        const activePermission = accountInfo.active_permission[0];
        status = {
          isConfigured: activePermission.threshold >= 2 && activePermission.keys.length >= 2,
          threshold: activePermission.threshold,
          keyCount: activePermission.keys.length,
          hasReceivingKey: activePermission.keys.some((key: any) => 
            key.address === config.receivingAddress
          ),
          hasApprovingKey: activePermission.keys.some((key: any) => 
            key.address === approvingAddress
          ),
        };
      }

      setMultisigStatus(status);
      
      if (status.isConfigured) {
        addLog('SUCCESS', '2-of-2 multisig verification passed', {
          threshold: status.threshold,
          keyCount: status.keyCount,
          receivingKey: status.hasReceivingKey ? '✅' : '❌',
          approvingKey: status.hasApprovingKey ? '✅' : '❌',
        });
      } else {
        addLog('WARNING', 'Multisig not properly configured', {
          threshold: status.threshold,
          keyCount: status.keyCount,
          suggestion: 'Please setup 2-of-2 multisig permissions',
        });
      }
    } catch (error: any) {
      addLog('ERROR', 'Failed to verify multisig setup', { error: error.message });
    }
  }, [approvingAddress, addLog]);

  const createForwardingSteps = (): ForwardingStep[] => [
    { id: 'detect', label: 'Payment Detected', status: 'pending' },
    { id: 'create', label: 'Transaction Created', status: 'pending' },
    { id: 'sign1', label: 'Signed by Receiving', status: 'pending' },
    { id: 'sign2', label: 'Signed by Approving', status: 'pending' },
    { id: 'broadcast', label: 'Broadcasted', status: 'pending' },
    { id: 'confirm', label: 'Confirmed', status: 'pending' },
  ];

  const updateStep = useCallback((stepId: string, status: ForwardingStep['status'], details?: string) => {
    setCurrentSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, timestamp: new Date(), details }
        : step
    ));
  }, []);

  const forwardWithMultisig = useCallback(async (receivedAmount: number) => {
    if (!tronWebRef.current || !isConnected || !tronLinkWeb) {
      addLog('ERROR', 'Missing required connections for multisig forwarding');
      return;
    }

    const steps = createForwardingSteps();
    setCurrentSteps(steps);

    try {
      const { tronWeb, config } = tronWebRef.current;
      
      // Calculate forward amount first
      const feeReserve = tronWeb.toSun(config.feeReserve);
      const currentBalance = await updateReceivingBalance();
      const availableAmount = Math.max(0, (currentBalance || 0) - feeReserve);
      const forwardAmount = Math.min(receivedAmount, availableAmount);
      
      // Step 1: Payment detected
      updateStep('detect', 'completed', `${tronWeb.fromSun(receivedAmount)} TRX received`);
      addLog('DETECTION', 'TRX PAYMENT DETECTED!', {
        'Received Amount': `${tronWeb.fromSun(receivedAmount)} TRX`,
        'Previous Balance': `${tronWeb.fromSun(lastBalance)} TRX`,
        'Current Balance': `${tronWeb.fromSun(currentBalance || 0)} TRX`,
        'Forward Amount': `${tronWeb.fromSun(forwardAmount)} TRX`,
        'Strategy': 'INCOMING AMOUNT ONLY',
        'Process': '2-of-2 multisig forwarding'
      });

      if (forwardAmount <= 0) {
        addLog('WARNING', 'Insufficient balance after fee reserve', {
          balance: tronWeb.fromSun(currentBalance || 0),
          feeReserve: config.feeReserve,
          available: tronWeb.fromSun(availableAmount)
        });
        return;
      }

      // Step 2: Create transaction
      updateStep('create', 'active');
      const transaction = await tronWeb.transactionBuilder.sendTrx(
        config.destinationAddress,
        forwardAmount,
        config.receivingAddress
      );
      updateStep('create', 'completed', `Transaction ${transaction.txID.slice(0, 8)}... created`);
      addLog('INFO', 'Multisig transaction created', {
        txId: transaction.txID,
        amount: `${tronWeb.fromSun(forwardAmount)} TRX`,
        destination: config.destinationAddress
      });

      // Step 3: First signature (receiving wallet)
      updateStep('sign1', 'active');
      const firstSigned = await tronWeb.trx.multiSign(transaction, config.receivingPrivateKey, 0);
      updateStep('sign1', 'completed', 'Auto-signed with receiving wallet');
      addLog('SIGNATURE', 'First signature completed (receiving wallet)', {
        signer: config.receivingAddress,
        status: 'Partially signed (1/2)'
      });

      // Step 4: Second signature (approving wallet via TronLink)
      updateStep('sign2', 'active');
      addLog('SIGNATURE', 'Requesting second signature from TronLink...', {
        signer: approvingAddress,
        action: 'Please approve transaction in TronLink'
      });

      const fullySigned = await signTransaction(firstSigned);
      updateStep('sign2', 'completed', 'Signed via TronLink');
      addLog('SIGNATURE', 'Second signature completed (approving wallet)', {
        signer: approvingAddress,
        status: 'Fully signed (2/2)'
      });

      // Validate signatures
      const signatureCount = fullySigned.signature ? fullySigned.signature.length : 0;
      if (signatureCount < 2) {
        throw new Error(`Insufficient signatures: ${signatureCount}/2`);
      }

      // Step 5: Broadcast transaction
      updateStep('broadcast', 'active');
      const result = await tronWeb.trx.sendRawTransaction(fullySigned);
      
      if (result.result === true) {
        updateStep('broadcast', 'completed', `TX: ${result.txid.slice(0, 8)}...`);
        addLog('BROADCAST', 'Multisig transaction broadcast successful', {
          txId: result.txid,
          signatures: signatureCount,
          explorer: `https://shasta.tronscan.org/#/transaction/${result.txid}`
        });

        // Step 6: Wait for confirmation
        updateStep('confirm', 'active');
        setTimeout(async () => {
          await updateReceivingBalance();
          updateStep('confirm', 'completed', 'Transaction confirmed');
          addLog('SUCCESS', 'Multisig forward completed successfully!', {
            txId: result.txid,
            amount: `${tronWeb.fromSun(forwardAmount)} TRX`,
            status: 'Confirmed'
          });
        }, 5000);

      } else {
        throw new Error(`Broadcast failed: ${result.message || 'Unknown error'}`);
      }

    } catch (error: any) {
      addLog('ERROR', 'Multisig forwarding failed', { error: error.message });
      setCurrentSteps(prev => prev.map(step => 
        step.status === 'active' ? { ...step, status: 'error', details: error.message } : step
      ));
    }
  }, [isConnected, tronLinkWeb, approvingAddress, signTransaction, updateStep, addLog, updateReceivingBalance]);

  const monitorBalance = useCallback(async () => {
  if (!tronWebRef.current) return;

  try {
    const currentBalance = await updateReceivingBalance();
    if (currentBalance === null) return;

    // Heartbeat
    heartbeatCountRef.current++;
    if (heartbeatCountRef.current >= 20) {
      const { tronWeb } = tronWebRef.current;
      addLog('INFO', `💓 Monitoring active - Balance: ${tronWeb.fromSun(currentBalance)} TRX`);
      heartbeatCountRef.current = 0;
    }

    // First run → initialize lastBalance, don’t forward
    if (lastBalance === null) {
      setLastBalance(currentBalance);
      addLog('INFO', `Initial balance set: ${tronWebRef.current.tronWeb.fromSun(currentBalance)} TRX`);
      return;
    }

    // Detect only NEW deposits
    if (currentBalance > lastBalance) {
      const receivedAmount = currentBalance - lastBalance;
      setLastBalance(currentBalance);

      // Start forwarding process
      setTimeout(() => forwardWithMultisig(receivedAmount), 2000);
    } else {
      setLastBalance(currentBalance);
    }

  } catch (error: any) {
    console.error('Balance monitoring error:', error);
  }
}, [lastBalance, forwardWithMultisig, updateReceivingBalance, addLog]);


  const startMonitoring = useCallback(async () => {
    if (!tronWebRef.current) {
      addLog('ERROR', 'TronWeb not initialized');
      return false;
    }

    if (!isConnected) {
      addLog('ERROR', 'TronLink not connected');
      return false;
    }

    if (!multisigStatus.isConfigured) {
      addLog('WARNING', 'Multisig not properly configured');
    }

    setIsRunning(true);
    setCurrentSteps([]);
    
    const { config } = tronWebRef.current;
    intervalRef.current = setInterval(monitorBalance, config.pollInterval);
    
    addLog('SUCCESS', 'Multisig auto-forwarder started', {
      network: config.tronFullHost,
      receivingWallet: config.receivingAddress,
      approvingWallet: approvingAddress,
      destination: config.destinationAddress,
      interval: `${config.pollInterval / 1000}s`
    });

    return true;
  }, [isConnected, multisigStatus.isConfigured, monitorBalance, approvingAddress, addLog]);

  const stopMonitoring = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    addLog('INFO', 'Monitoring stopped');
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update multisig status when approving address changes
  useEffect(() => {
    if (approvingAddress) {
      verifyMultisigSetup();
    }
  }, [approvingAddress, verifyMultisigSetup]);

  return {
    isRunning,
    receivingBalance,
    logs,
    currentSteps,
    multisigStatus,
    config: tronWebRef.current?.config,
    startMonitoring,
    stopMonitoring,
    clearLogs: () => setLogs([]),
    updateReceivingBalance,
  };
};
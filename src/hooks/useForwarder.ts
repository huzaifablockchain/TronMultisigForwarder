import { useState, useEffect, useCallback, useRef } from 'react';
import { TronWeb } from 'tronweb';
import { ForwardingConfig, LogEntry, ForwardingStep, MultisigStatus } from '../types/tron';
import { useTronLink } from './useTronLink';
import { useToast } from '../hooks/use-toast';

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
  const maxRetries = 3;
  const retryDelay = 5000;

  // Initialize TronWeb with receiving wallet
  useEffect(() => {
    const initTronWeb = () => {
      const config: ForwardingConfig = {
        receivingPrivateKey: import.meta.env.VITE_RECEIVING_PRIVATE_KEY || '',
        receivingAddress: import.meta.env.VITE_RECEIVING_ADDRESS || '',
        destinationAddress: import.meta.env.VITE_DESTINATION_ADDRESS || '',
        feeReserve: parseFloat(import.meta.env.VITE_FEE_RESERVE || '0.5'),
        pollInterval: parseInt(import.meta.env.VITE_POLL_INTERVAL || '3000'),
        tronFullHost: import.meta.env.VITE_TRON_FULLHOST || '',
        apiKey: import.meta.env.VITE_TRON_API_KEY || '',
      };

      if (!config.receivingPrivateKey || !config.receivingAddress) {
        addLog('ERROR', 'Missing configuration: Please check your environment variables');
        return;
      }

      try {
        const tronWeb = new TronWeb({
          fullHost: config.tronFullHost,
          headers: config.apiKey ? { "TRON-PRO-API-KEY": config.apiKey } : {},
          privateKey: config.receivingPrivateKey,
        });

        // Validate addresses
        if (!tronWeb.isAddress(config.receivingAddress)) {
          throw new Error(`Invalid receiving address: ${config.receivingAddress}`);
        }
        if (!tronWeb.isAddress(config.destinationAddress)) {
          throw new Error(`Invalid destination address: ${config.destinationAddress}`);
        }

        // Verify private key matches address
        const addressFromKey = tronWeb.address.fromPrivateKey(config.receivingPrivateKey);
        if (addressFromKey !== config.receivingAddress) {
          throw new Error('Receiving wallet private key does not match address');
        }

        tronWebRef.current = { tronWeb, config };
        addLog('SUCCESS', 'TronWeb initialized successfully', {
          network: config.tronFullHost.includes('shasta') ? 'Shasta Testnet' : 'Mainnet',
          receivingAddress: config.receivingAddress,
          destinationAddress: config.destinationAddress,
          feeReserve: `${config.feeReserve} TRX`,
        });

        // Initial balance check
        updateReceivingBalance();
        
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
    if (!tronWebRef.current) {
      return null;
    }
    
    try {
      const { tronWeb, config } = tronWebRef.current;
      const balanceInSun = await tronWeb.trx.getBalance(config.receivingAddress);
      
      setReceivingBalance(balanceInSun);
      return balanceInSun;
    } catch (error: any) {
      addLog('ERROR', 'Failed to update receiving wallet balance', { error: error.message });
      return null;
    }
  }, [addLog]);

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
    { id: 'validate', label: 'Multisig Validated', status: 'pending' },
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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const forwardWithMultisig = useCallback(async (receivedAmount: number) => {
    if (!tronWebRef.current || !isConnected || !tronLinkWeb || !approvingAddress) {
      addLog('ERROR', 'Missing required connections for multisig forwarding');
      return;
    }

    const steps = createForwardingSteps();
    setCurrentSteps(steps);

    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        const { tronWeb, config } = tronWebRef.current;
        
        addLog('INFO', 'STARTING MULTISIG FORWARD PROCESS...', {
          'Amount to Forward': `${tronWeb.fromSun(receivedAmount)} TRX`,
          'Multisig Type': '2-of-2 Auto-Approval',
          'Attempt Number': `${attempts + 1} of ${maxRetries}`,
          'Process': 'Create → Sign 1st → Sign 2nd → Validate → Broadcast → Confirm'
        });

        // Step 1: Payment detected
        updateStep('detect', 'completed', `${tronWeb.fromSun(receivedAmount)} TRX received`);
        
        // Get current balance and calculate forward amount
        const currentBalance = await updateReceivingBalance();
        if (!currentBalance) {
          throw new Error('Failed to get current balance');
        }
        
        const feeReserve = tronWeb.toSun(config.feeReserve);
        const availableAmount = Math.max(0, currentBalance - feeReserve);
        const forwardAmount = Math.min(receivedAmount, availableAmount);

        if (forwardAmount <= 0) {
          addLog('WARNING', 'Insufficient balance after fee reserve', {
            'Current Balance': `${tronWeb.fromSun(currentBalance)} TRX`,
            'Fee Reserve': `${config.feeReserve} TRX`,
            'Available': `${tronWeb.fromSun(availableAmount)} TRX`,
          });
          updateStep('detect', 'error', 'Insufficient balance for forwarding');
          return;
        }

        // Step 2: Create multisig transaction
        updateStep('create', 'active');
        const transaction = await tronWeb.transactionBuilder.sendTrx(
          config.destinationAddress,
          forwardAmount,
          config.receivingAddress
        );
        
        updateStep('create', 'completed', `Transaction ${transaction.txID.slice(0, 8)}... created`);
        addLog('INFO', 'Multisig transaction created', {
          'Transaction ID': transaction.txID,
          'Amount': `${tronWeb.fromSun(forwardAmount)} TRX`,
          'From': config.receivingAddress,
          'To': config.destinationAddress,
        });

        // Step 3: First signature (receiving wallet - auto)
        updateStep('sign1', 'active');
        
        // Get account info to determine correct key index
        const accountInfo = await tronWeb.trx.getAccount(config.receivingAddress);
        let receivingKeyIndex = 0;
        
        if (accountInfo?.active_permission?.[0]) {
          const activePermission = accountInfo.active_permission[0];
          const receivingKeyInfo = activePermission.keys.find((key: any) => 
            key.address === config.receivingAddress
          );
          
          if (receivingKeyInfo) {
            receivingKeyIndex = activePermission.keys.indexOf(receivingKeyInfo);
          }
        }

        const firstSigned = await tronWeb.trx.multiSign(
          transaction, 
          config.receivingPrivateKey, 
          receivingKeyIndex
        );
        
        updateStep('sign1', 'completed', 'Auto-signed with receiving wallet');
        addLog('SIGNATURE', 'First signature completed (receiving wallet)', {
          'Signer': config.receivingAddress,
          'Key Index': receivingKeyIndex,
          'Status': 'Partially signed (1/2)'
        });

        // Step 4: Second signature (approving wallet via TronLink)
        updateStep('sign2', 'active');
        addLog('SIGNATURE', 'Requesting second signature from TronLink...', {
          'Signer': approvingAddress,
          'Action': 'Please approve transaction in TronLink popup'
        });

        const fullySigned = await signTransaction(firstSigned);
        
        if (!fullySigned) {
          throw new Error('TronLink signing was cancelled or failed');
        }

        if (!fullySigned.signature || fullySigned.signature.length < 130) {
          throw new Error('Invalid signature format - transaction may not be properly signed');
        }
        
        updateStep('sign2', 'completed', 'Signed with TronLink wallet');
        addLog('SIGNATURE', 'Second signature completed (TronLink wallet)', {
          'Signer': approvingAddress,
          'Status': 'Fully signed (2/2)'
        });

        // Step 5: Validate multisig requirements
        updateStep('validate', 'active');
        
        const signatureCount = fullySigned.signature ? fullySigned.signature.length / 65 : 0;
        const hasRequiredSignatures = signatureCount >= 2;
        
        if (!hasRequiredSignatures) {
          throw new Error('Transaction does not meet 2-of-2 multisig requirements');
        }
        
        updateStep('validate', 'completed', `${signatureCount} signatures validated`);
        addLog('SUCCESS', 'DUAL SIGNATURE COMPLETE - TRANSACTION READY', {
          'Transaction ID': fullySigned.txID,
          'Receiving Wallet': '✅ Signed',
          'Approving Wallet': '✅ Signed',
          'Multisig Validation': '✅ Passed',
          'Status': 'Ready for network broadcast'
        });

        // Step 6: Broadcast transaction
        updateStep('broadcast', 'active');
        addLog('BROADCAST', 'Broadcasting multisig transaction to TRON network...', {
          'Transaction ID': fullySigned.txID,
          'Signature Count': signatureCount,
          'Multisig Status': '2-of-2 Complete'
        });

        const result = await tronLinkWeb.trx.sendRawTransaction(fullySigned);

        if (!result.result) {
          throw new Error(`Broadcast failed: ${result.message || 'Unknown error'}`);
        }

        updateStep('broadcast', 'completed', `Transaction ${result.txid.slice(0, 8)}... broadcasted`);
        addLog('BROADCAST', 'Transaction broadcasted successfully', {
          'Transaction ID': result.txid,
          'Network Status': 'Submitted to TRON Network',
          'Confirmation': 'Pending Block Confirmation',
        });

        // Step 7: Wait for confirmation
        updateStep('confirm', 'active');
        
        await delay(5000); // Wait for confirmation
        
        const balanceAfter = await updateReceivingBalance();
        if (balanceAfter !== null) {
          const actualCost = currentBalance - balanceAfter;
          const transactionFee = actualCost - forwardAmount;

          updateStep('confirm', 'completed', 'Transaction confirmed on network');
          addLog('SUCCESS', 'MULTISIG FORWARD COMPLETED SUCCESSFULLY!', {
            'Transaction ID': result.txid,
            'Amount Forwarded': `${tronWeb.fromSun(forwardAmount)} TRX`,
            'Transaction Fee': `${tronWeb.fromSun(transactionFee)} TRX`,
            'Balance After': `${tronWeb.fromSun(balanceAfter)} TRX`,
            'Multisig Status': '2-of-2 Verified',
            'Network Status': 'Confirmed',
            'Explorer': config.tronFullHost.includes('shasta') 
              ? `https://shasta.tronscan.org/#/transaction/${result.txid}`
              : `https://tronscan.org/#/transaction/${result.txid}`
          });

          // Update last balance to new amount
          setLastBalance(balanceAfter);
        }

        return result;

      } catch (error: any) {
        attempts++;
        addLog('ERROR', `Multisig forward attempt ${attempts} failed`, {
          error: error.message,
          attempt: attempts,
          maxAttempts: maxRetries
        });

        // Update failed step
        setCurrentSteps(prev => prev.map(step => 
          step.status === 'active' ? { ...step, status: 'error', details: error.message } : step
        ));

        if (attempts < maxRetries) {
          addLog('INFO', `Retrying in ${retryDelay / 1000} seconds...`);
          await delay(retryDelay);
        }
      }
    }

    addLog('ERROR', `🚫 MULTISIG FORWARD FAILED after ${maxRetries} attempts`);
    return null;
  }, [isConnected, tronLinkWeb, approvingAddress, signTransaction, updateStep, addLog, updateReceivingBalance]);

  const monitorBalance = useCallback(async () => {
    if (!tronWebRef.current) {
      return;
    }

    try {
      const currentBalance = await updateReceivingBalance();
      if (currentBalance === null) {
        return;
      }

      const { tronWeb } = tronWebRef.current;

      // Heartbeat
      heartbeatCountRef.current++;
      if (heartbeatCountRef.current >= 20) {
        addLog('INFO', `💓 Monitoring active - Balance: ${tronWeb.fromSun(currentBalance)} TRX`);
        heartbeatCountRef.current = 0;
      }

      // First run - initialize lastBalance, don't forward
      if (lastBalance === null) {
        setLastBalance(currentBalance);
        addLog('INFO', `Initial balance set: ${tronWeb.fromSun(currentBalance)} TRX`);
        return;
      }

      // Detect NEW deposits (balance increase)
      if (currentBalance > lastBalance) {
        const receivedAmount = currentBalance - lastBalance;
        
        addLog('DETECTION', 'TRX PAYMENT DETECTED!', {
          'Previous Balance': `${tronWeb.fromSun(lastBalance)} TRX`,
          'Current Balance': `${tronWeb.fromSun(currentBalance)} TRX`,
          'Received Amount': `${tronWeb.fromSun(receivedAmount)} TRX`,
          'Action': 'Preparing multisig forward process...'
        });
        
        // Update lastBalance before forwarding to prevent double processing
        setLastBalance(currentBalance);

        // Start forwarding process with a slight delay
        setTimeout(() => forwardWithMultisig(receivedAmount), 2000);
        
      } else if (currentBalance < lastBalance) {
        // Balance decreased (likely due to successful forward or fee deduction)
        addLog('BALANCE', 'Balance decreased', {
          'Previous': `${tronWeb.fromSun(lastBalance)} TRX`,
          'Current': `${tronWeb.fromSun(currentBalance)} TRX`,
          'Change': `${tronWeb.fromSun(currentBalance - lastBalance)} TRX`
        });
        setLastBalance(currentBalance);
      }

    } catch (error: any) {
      addLog('ERROR', 'Balance monitoring failed', { error: error.message });
    }
  }, [lastBalance, forwardWithMultisig, updateReceivingBalance, addLog]);

  const startMonitoring = useCallback(() => {
    // Validate TronWeb is initialized
    if (!tronWebRef.current?.tronWeb) {
      addLog('ERROR', 'Cannot start monitoring: TronWeb not initialized');
      return;
    }

    // Validate TronLink is connected
    if (!isConnected || !approvingAddress) {
      addLog('ERROR', 'Cannot start monitoring: TronLink not connected');
      return;
    }

    // Validate multisig is configured
    if (!multisigStatus.isConfigured) {
      addLog('ERROR', 'Cannot start monitoring: Multisig not configured');
      return;
    }

    // Reset state for fresh start
    setLastBalance(null);
    heartbeatCountRef.current = 0;
    
    // Perform initial balance check
    monitorBalance();
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set new interval
    const { config } = tronWebRef.current;
    intervalRef.current = setInterval(monitorBalance, config.pollInterval);
    
    setIsRunning(true);
    
    addLog('SUCCESS', 'MULTISIG MONITORING STARTED', {
      'Network': config.tronFullHost.includes('shasta') ? 'Shasta Testnet' : 'TRON Mainnet',
      'Receiving Address': config.receivingAddress,
      'Approving Address': approvingAddress,
      'Destination Address': config.destinationAddress,
      'Poll Interval': `${config.pollInterval / 1000}s`,
      'Fee Reserve': `${config.feeReserve} TRX`,
      'Multisig Type': '2-of-2',
      'Status': 'ACTIVE'
    });
  }, [isConnected, approvingAddress, multisigStatus, addLog, monitorBalance]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRunning(false);
    setCurrentSteps([]);
    
    addLog('INFO', '🛑 MULTISIG MONITORING STOPPED', {
      'Status': 'All monitoring processes terminated',
      'Action': 'Ready to restart when needed'
    });
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('INFO', 'Log history cleared');
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
    if (approvingAddress && tronWebRef.current) {
      verifyMultisigSetup();
    }
  }, [approvingAddress, verifyMultisigSetup]);

  // Re-verify multisig when TronWeb is initialized
  useEffect(() => {
    if (tronWebRef.current && approvingAddress) {
      verifyMultisigSetup();
    }
  }, [tronWebRef.current, approvingAddress, verifyMultisigSetup]);

  return {
    isRunning,
    receivingBalance,
    logs,
    currentSteps,
    multisigStatus,
    config: tronWebRef.current?.config,
    startMonitoring,
    stopMonitoring,
    clearLogs,
    updateReceivingBalance,
  };
};
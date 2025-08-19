import { useState, useEffect, useCallback } from 'react';
import { TronLinkWindow, TronWebInstance } from '@/types/tron';
import { useToast } from '@/hooks/use-toast';

export const useTronLink = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [approvingAddress, setApprovingAddress] = useState<string>('');
  const [approvingBalance, setApprovingBalance] = useState<number>(0);
  const [tronWeb, setTronWeb] = useState<TronWebInstance | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  // Check if TronLink is available
  useEffect(() => {
    const checkTronLink = () => {
      const win = window as TronLinkWindow;
      
      if (win.tronLink && win.tronWeb) {
        setIsAvailable(true);
        setTronWeb(win.tronWeb);
        
        // Check if already connected
        if (win.tronWeb.defaultAddress && win.tronWeb.defaultAddress.base58) {
          setIsConnected(true);
          setApprovingAddress(win.tronWeb.defaultAddress.base58);
          updateBalance(win.tronWeb.defaultAddress.base58);
        }
      } else {
        setIsAvailable(false);
      }
    };

    // Initial check
    checkTronLink();

    // Listen for TronLink changes
    const handleTronLinkReady = () => {
      checkTronLink();
    };

    window.addEventListener('tronLink#initialized', handleTronLinkReady);
    
    // Fallback check after a delay
    const timer = setTimeout(checkTronLink, 1000);

    return () => {
      window.removeEventListener('tronLink#initialized', handleTronLinkReady);
      clearTimeout(timer);
    };
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!isAvailable) return;

    const handleAccountChange = () => {
      const win = window as TronLinkWindow;
      if (win.tronWeb?.defaultAddress?.base58) {
        const newAddress = win.tronWeb.defaultAddress.base58;
        setApprovingAddress(newAddress);
        updateBalance(newAddress);
        
        toast({
          title: "Account Changed",
          description: `Connected to ${newAddress.slice(0, 6)}...${newAddress.slice(-4)}`,
        });
      } else {
        setIsConnected(false);
        setApprovingAddress('');
        setApprovingBalance(0);
      }
    };

    window.addEventListener('message', (e) => {
      if (e.data && e.data.message && e.data.message.action === 'accountsChanged') {
        handleAccountChange();
      }
    });

    return () => {
      window.removeEventListener('message', handleAccountChange);
    };
  }, [isAvailable, toast]);

  const updateBalance = useCallback(async (address: string) => {
    if (!tronWeb || !address) return;

    try {
      const balance = await tronWeb.trx.getBalance(address);
      setApprovingBalance(balance);
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  }, [tronWeb]);

  const connect = useCallback(async () => {
    if (!isAvailable) {
      toast({
        title: "TronLink Not Found",
        description: "Please install TronLink extension to continue.",
        variant: "destructive",
      });
      return false;
    }

    setIsConnecting(true);

    try {
      const win = window as TronLinkWindow;
      
      if (win.tronLink) {
        await win.tronLink.request({ method: 'tron_requestAccounts' });
      }

      if (win.tronWeb?.defaultAddress?.base58) {
        const address = win.tronWeb.defaultAddress.base58;
        setIsConnected(true);
        setApprovingAddress(address);
        setTronWeb(win.tronWeb);
        await updateBalance(address);

        toast({
          title: "TronLink Connected",
          description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
        });

        return true;
      } else {
        throw new Error('Failed to get wallet address');
      }
    } catch (error: any) {
      console.error('TronLink connection failed:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to TronLink",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isAvailable, updateBalance, toast]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setApprovingAddress('');
    setApprovingBalance(0);
    setTronWeb(null);
    
    toast({
      title: "Disconnected",
      description: "TronLink wallet disconnected",
    });
  }, [toast]);

  const signTransaction = useCallback(async (transaction: any) => {
    if (!tronWeb || !isConnected) {
      throw new Error('TronLink not connected');
    }

    try {
      // Use multiSign for multisig transactions
      const signedTx = await tronWeb.trx.sign(transaction, undefined, 0);
      return signedTx;
    } catch (error: any) {
      console.error('Transaction signing failed:', error);
      throw new Error(error.message || 'Failed to sign transaction');
    }
  }, [tronWeb, isConnected]);

  return {
    isAvailable,
    isConnected,
    isConnecting,
    approvingAddress,
    approvingBalance,
    tronWeb,
    connect,
    disconnect,
    signTransaction,
    updateBalance: () => updateBalance(approvingAddress),
  };
};
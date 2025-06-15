import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { RedditAuth } from '../utils/reddit-auth';

interface AuthCallbackProps {
  onAuthComplete: (success: boolean) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onAuthComplete }) => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Reddit authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Reddit authentication error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        const redditAuth = RedditAuth.getInstance();
        const success = await redditAuth.handleCallback(code, state);

        if (success) {
          setStatus('success');
          setMessage('Successfully connected to Reddit!');
          setTimeout(() => onAuthComplete(true), 2000);
        } else {
          throw new Error('Failed to complete Reddit authentication');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');
        setTimeout(() => onAuthComplete(false), 3000);
      }
    };

    handleCallback();
  }, [onAuthComplete]);

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader className="h-8 w-8 text-orange-600 dark:text-orange-400 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20';
      case 'success':
        return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
      case 'error':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
      <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl border ${getStatusColor()} transition-colors duration-300`}>
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            {getIcon()}
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Reddit Authentication
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          
          {status === 'processing' && (
            <div className="flex justify-center">
              <div className="boxes">
                <div className="box"></div>
                <div className="box"></div>
                <div className="box"></div>
                <div className="box"></div>
              </div>
            </div>
          )}
          
          {status === 'success' && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Redirecting you back to the app...
            </p>
          )}
          
          {status === 'error' && (
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Return to App
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
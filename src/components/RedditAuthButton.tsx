import React from 'react';
import { LogIn, LogOut, User } from 'lucide-react';
import { RedditAuth } from '../utils/reddit-auth';
import { RedditAuthState } from '../types';

interface RedditAuthButtonProps {
  authState: RedditAuthState;
  onAuthStateChange: (authState: RedditAuthState) => void;
}

const RedditAuthButton: React.FC<RedditAuthButtonProps> = ({ authState, onAuthStateChange }) => {
  const redditClientId = import.meta.env.VITE_REDDIT_CLIENT_ID || import.meta.env.VITE_PUBLIC_REDDIT_CLIENT_ID;
  const isConfigured = Boolean(redditClientId);

  const handleLogin = () => {
    if (!isConfigured) {
      alert('Reddit authentication is not properly configured. Please check the environment variables.');
      return;
    }

    try {
      const redditAuth = RedditAuth.getInstance();
      const authUrl = redditAuth.generateAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error generating auth URL:', error);
      alert('Reddit authentication is not properly configured. Please check the environment variables.');
    }
  };

  const handleLogout = () => {
    const redditAuth = RedditAuth.getInstance();
    redditAuth.logout();
    onAuthStateChange(redditAuth.getAuthState());
  };

  if (authState.isAuthenticated) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <User className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            Reddit Connected
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className={`flex items-center space-x-2 px-4 py-2 font-medium rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl ${
        isConfigured 
          ? 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white' 
          : 'bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700 text-white cursor-pointer'
      }`}
    >
      <LogIn className="h-4 w-4" />
      <span>
        {!isConfigured
          ? 'Reddit Auth Not Configured' 
          : 'Connect Reddit Account'
        }
      </span>
    </button>
  );
};

export default RedditAuthButton;
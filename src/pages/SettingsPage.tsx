import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  LogOut,
  ArrowLeft,
  Loader,
  Sun,
  Moon,
  Hash,
  Plus,
  X,
  MessageSquare,
  Brain,
  Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import RedditAuthButton from '../components/RedditAuthButton';
import ModelSelector from '../components/ModelSelector';
import { RedditAuth } from '../utils/reddit-auth';
import { RedditAuthState } from '../types';
import { supabase } from '../lib/supabase';

interface GeminiKeyStatus {
  hasKey: boolean;
  status: 'not_set' | 'valid' | 'invalid' | 'testing';
  apiKey?: string;
}

interface UserSettings {
  defaultPostsCount: number;
  defaultModel: string;
  savedKeywords: string[];
}

const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();
  
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Gemini API Key state
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<GeminiKeyStatus>({
    hasKey: false,
    status: 'not_set'
  });
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);
  const [loadingGeminiKey, setLoadingGeminiKey] = useState(true);
  const [deletingGeminiKey, setDeletingGeminiKey] = useState(false);

  // Reddit OAuth state
  const [redditAuthState, setRedditAuthState] = useState<RedditAuthState>({
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    username: null
  });

  // User settings state
  const [userSettings, setUserSettings] = useState<UserSettings>({
    defaultPostsCount: 10,
    defaultModel: 'gemini-2.0-flash',
    savedKeywords: []
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Keyword management state
  const [newMonitorKeyword, setNewMonitorKeyword] = useState('');
  const [newKeywordFrequency, setNewKeywordFrequency] = useState(24);
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [triggeringSearch, setTriggeringSearch] = useState(false);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(true);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);

  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDark.toString());
  }, [isDark]);

  useEffect(() => {
    // Initialize Reddit auth state
    const redditAuth = RedditAuth.getInstance();
    setRedditAuthState(redditAuth.getAuthState());

    // Load Gemini API key status
    loadGeminiKeyStatus();

    // Load user settings from localStorage
    loadUserSettings();

    // Load keywords
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      setKeywordsLoading(true);
      setKeywordsError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setKeywordsError('User not authenticated');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('keyword_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setKeywords(data || []);
    } catch (err) {
      console.error('Error fetching keywords:', err);
      setKeywordsError(err instanceof Error ? err.message : 'Failed to fetch keywords');
    } finally {
      setKeywordsLoading(false);
    }
  };

  const loadUserSettings = () => {
    try {
      const savedSettings = localStorage.getItem('userSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setUserSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const saveUserSettings = (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...userSettings, ...newSettings };
      setUserSettings(updatedSettings);
      localStorage.setItem('userSettings', JSON.stringify(updatedSettings));
      
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving user settings:', error);
      setErrorMessage('Failed to save settings');
    }
  };

  const toggleDarkMode = () => {
    setIsDark(!isDark);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleAuthStateChange = (newAuthState: RedditAuthState) => {
    setRedditAuthState(newAuthState);
  };

  const loadGeminiKeyStatus = async () => {
    try {
      setLoadingGeminiKey(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoadingGeminiKey(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-gemini-key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGeminiKeyStatus(data);
        if (data.hasKey && data.apiKey) {
          setGeminiKey(data.apiKey);
        }
      }
    } catch (error) {
      console.error('Error loading Gemini key status:', error);
    } finally {
      setLoadingGeminiKey(false);
    }
  };

  const validateGeminiKeyFormat = (key: string): boolean => {
    return key.startsWith('AIza') && key.length >= 30;
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKey.trim()) {
      setErrorMessage('Please enter a Gemini API key');
      return;
    }

    if (!validateGeminiKeyFormat(geminiKey)) {
      setErrorMessage('Invalid API key format. Gemini API keys should start with "AIza" and be at least 30 characters long.');
      return;
    }

    setSavingGeminiKey(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setErrorMessage('Authentication required');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-gemini-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: geminiKey }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeminiKeyStatus({
          hasKey: true,
          status: data.status,
          apiKey: geminiKey
        });
        setSuccessMessage('Gemini API key saved successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving Gemini key:', error);
      setErrorMessage('An unexpected error occurred');
    } finally {
      setSavingGeminiKey(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    setDeletingGeminiKey(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setErrorMessage('User not authenticated');
        setDeletingGeminiKey(false);
        return;
      }
      // Delete the user's row from user_settings
      const { error: deleteError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id);
      if (deleteError) {
        setErrorMessage('Failed to delete API key');
      } else {
        setGeminiKey('');
        setGeminiKeyStatus({ hasKey: false, status: 'not_set' });
        setSuccessMessage('Gemini API key deleted and settings reset.');
      }
    } catch (error) {
      setErrorMessage('Failed to delete API key');
    } finally {
      setDeletingGeminiKey(false);
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !userSettings.savedKeywords.includes(newKeyword.trim())) {
      const updatedKeywords = [...userSettings.savedKeywords, newKeyword.trim()];
      saveUserSettings({ savedKeywords: updatedKeywords });
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const updatedKeywords = userSettings.savedKeywords.filter(keyword => keyword !== keywordToRemove);
    saveUserSettings({ savedKeywords: updatedKeywords });
  };

  const handleDefaultSettingsChange = (field: keyof UserSettings, value: any) => {
    saveUserSettings({ [field]: value });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'testing':
        return <Loader className="h-5 w-5 text-orange-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Valid API key';
      case 'invalid':
        return 'Invalid API key';
      case 'testing':
        return 'Testing API key...';
      default:
        return 'No API key set';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-600 dark:text-green-400';
      case 'invalid':
        return 'text-red-600 dark:text-red-400';
      case 'testing':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const handleAddMonitorKeyword = async () => {
    if (!newMonitorKeyword.trim()) {
      setErrorMessage('Please enter a keyword to monitor');
      return;
    }

    setAddingKeyword(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: insertError } = await supabase
        .from('keyword_searches')
        .insert({
          user_id: user.id,
          keyword: newMonitorKeyword.trim(),
          search_frequency_hours: newKeywordFrequency,
          next_search_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }

      await loadKeywords();
      setNewMonitorKeyword('');
      setNewKeywordFrequency(24);
      setSuccessMessage('Keyword added for monitoring!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error adding keyword:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add keyword');
    }
    
    setAddingKeyword(false);
  };

  const handleRemoveMonitorKeyword = async (keywordId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('keyword_searches')
        .delete()
        .eq('id', keywordId);

      if (deleteError) {
        throw deleteError;
      }

      await loadKeywords();
      setSuccessMessage('Keyword removed from monitoring');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error removing keyword:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove keyword');
    }
  };

  const toggleKeyword = async (keywordId: string, isActive: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('keyword_searches')
        .update({ is_active: isActive })
        .eq('id', keywordId);

      if (updateError) {
        throw updateError;
      }

      await loadKeywords();
    } catch (err) {
      console.error('Error toggling keyword:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to toggle keyword');
    }
  };

  const handleTriggerSearch = async () => {
    setTriggeringSearch(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/keyword-monitor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger search: ${response.statusText}`);
      }

      await loadKeywords();
      setSuccessMessage('Manual search completed! Check the Mentions page for new results.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error triggering search:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to trigger search');
    }
    
    setTriggeringSearch(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-300">
      
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                to="/dashboard"
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </Link>
              <div className="flex items-center space-x-3">
                <Settings className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">Settings</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-6 py-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-green-700 dark:text-green-300 text-sm">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm">{errorMessage}</p>
          </div>
        )}

        {keywordsError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm">{keywordsError}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Keyword Monitoring Section - Moved to top */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <Search className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Keyword Monitoring</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Set up keywords to monitor across Reddit. We'll automatically search for mentions and analyze sentiment.
            </p>

            {/* Add New Keyword */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Keyword</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Keyword to Monitor
                  </label>
                  <input
                    type="text"
                    value={newMonitorKeyword}
                    onChange={(e) => setNewMonitorKeyword(e.target.value)}
                    placeholder="Enter keyword (e.g., your brand name)"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Frequency (hours)
                  </label>
                  <select
                    value={newKeywordFrequency}
                    onChange={(e) => setNewKeywordFrequency(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  >
                    <option value={1}>Every hour</option>
                    <option value={6}>Every 6 hours</option>
                    <option value={12}>Every 12 hours</option>
                    <option value={24}>Daily</option>
                    <option value={168}>Weekly</option>
                  </select>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleAddMonitorKeyword}
                  disabled={addingKeyword || !newMonitorKeyword.trim()}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    addingKeyword || !newMonitorKeyword.trim()
                      ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {addingKeyword ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span>Add Keyword</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleTriggerSearch}
                  disabled={triggeringSearch}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    triggeringSearch
                      ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {triggeringSearch ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      <span>Search Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Keywords List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Active Keywords ({keywords.length})
              </h3>
              
              {keywordsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-8 w-8 text-orange-500 animate-spin" />
                  <span className="ml-3 text-gray-600 dark:text-gray-300">Loading keywords...</span>
                </div>
              ) : keywords.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No keywords being monitored yet. Add some to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {keywords.map((keyword) => (
                    <div
                      key={keyword.id}
                      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {keyword.keyword}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            keyword.is_active 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                          }`}>
                            {keyword.is_active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>Frequency: Every {keyword.search_frequency_hours} hours</div>
                          <div>Total mentions found: {keyword.total_mentions_found}</div>
                          {keyword.last_searched_at && (
                            <div>Last searched: {new Date(keyword.last_searched_at).toLocaleString()}</div>
                          )}
                          {keyword.last_error && (
                            <div className="text-red-600 dark:text-red-400">Error: {keyword.last_error}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleKeyword(keyword.id, !keyword.is_active)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            keyword.is_active
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          }`}
                        >
                          {keyword.is_active ? 'Pause' : 'Resume'}
                        </button>
                        
                        <button
                          onClick={() => handleRemoveMonitorKeyword(keyword.id)}
                          className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg text-sm font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Information - Moved to top */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <User className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email Address Card */}
              <div className="group">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-lg">
                      <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Email Address</h3>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white break-all">
                    {user?.email}
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Verified</span>
                  </div>
                </div>
              </div>

              {/* Account Created Card */}
              <div className="group">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 rounded-lg">
                      <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10m6-10v10m-6-4h6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Member Since</h3>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Unknown'}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {user?.created_at ? `${Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))} days ago` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Stats */}
            <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/50">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
                </svg>
                <span>Account Overview</span>
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {geminiKeyStatus.hasKey ? '1' : '0'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">API Keys</div>
                </div>
                
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {redditAuthState.isAuthenticated ? '1' : '0'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Connected Accounts</div>
                </div>
                
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {userSettings.savedKeywords.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Saved Keywords</div>
                </div>
              </div>
            </div>
          </div>

          {/* General Preferences Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">General Preferences</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Customize your general application preferences and interface settings.
            </p>

            <div className="space-y-6">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Dark Mode</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Toggle between light and dark theme
                  </p>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                    isDark ? 'bg-orange-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isDark ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sun className={`h-3 w-3 text-yellow-500 transition-opacity ${isDark ? 'opacity-0' : 'opacity-100'}`} />
                    <Moon className={`h-3 w-3 text-gray-300 transition-opacity absolute ${isDark ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Saved Keywords Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <Hash className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Keywords</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Save frequently used search terms for quick access during analysis.
            </p>

            {/* Add Keyword Input */}
            <div className="space-y-4 mb-6">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="Enter a keyword to save..."
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                />
                <button
                  onClick={handleAddKeyword}
                  disabled={!newKeyword.trim() || userSettings.savedKeywords.includes(newKeyword.trim())}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    !newKeyword.trim() || userSettings.savedKeywords.includes(newKeyword.trim())
                      ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                  }`}
                >
                  <Plus className="h-5 w-5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Keywords List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Your Saved Keywords ({userSettings.savedKeywords.length})
              </h3>
              
              {userSettings.savedKeywords.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Hash className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No saved keywords yet. Add some to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {userSettings.savedKeywords.map((keyword, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 group hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="text-gray-900 dark:text-white font-medium truncate">
                        {keyword}
                      </span>
                      <button
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Default Analysis Settings Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <Brain className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Default Analysis Settings</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Set your preferred default values for new analyses to speed up your workflow.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Default Posts Count */}
              <div>
                <label htmlFor="defaultPosts" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <MessageSquare className="inline h-4 w-4 mr-1" />
                  Default Posts Count
                </label>
                <input
                  type="number"
                  id="defaultPosts"
                  min="1"
                  max="100"
                  value={userSettings.defaultPostsCount}
                  onChange={(e) => handleDefaultSettingsChange('defaultPostsCount', parseInt(e.target.value) || 10)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Number of posts to analyze by default (1-100)
                </p>
              </div>

              {/* Default AI Model */}
              <div>
                <ModelSelector
                  selectedModel={userSettings.defaultModel}
                  onModelChange={(model) => handleDefaultSettingsChange('defaultModel', model)}
                  disabled={false}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your preferred AI model for new analyses
                </p>
              </div>
            </div>

            {/* Settings Summary */}
            <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/50">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Current Defaults</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Posts per analysis:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{userSettings.defaultPostsCount}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">AI Model:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {userSettings.defaultModel.replace('gemini-', 'Gemini ')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gemini API Key Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <Key className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gemini API Key</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your Gemini API key is used to power the AI sentiment analysis. It's encrypted and stored securely.
            </p>

            {loadingGeminiKey ? (
              <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <Loader className="h-5 w-5 text-orange-500 animate-spin" />
                <span className="text-gray-600 dark:text-gray-300">Loading API key status...</span>
              </div>
            ) : (
              <>
                {/* API Key Status */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(geminiKeyStatus.status)}
                    <span className={`font-medium ${getStatusColor(geminiKeyStatus.status)}`}>
                      {getStatusText(geminiKeyStatus.status)}
                    </span>
                  </div>
                  {geminiKeyStatus.hasKey && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Last updated: {new Date().toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* API Key Input */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="geminiKey" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Gemini API Key
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-5 w-5" />
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        id="geminiKey"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                        placeholder="Enter your Gemini API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {showGeminiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Get your API key from{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 underline"
                      >
                        Google AI Studio
                      </a>
                    </p>
                  </div>

                  {/* Only show Save button if no key is set */}
                  {!geminiKeyStatus.hasKey && (
                    <button
                      onClick={handleSaveGeminiKey}
                      disabled={savingGeminiKey || !geminiKey.trim()}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                        savingGeminiKey || !geminiKey.trim()
                          ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                          : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 dark:from-orange-700 dark:to-amber-700 dark:hover:from-orange-800 dark:hover:to-amber-800 text-white transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {savingGeminiKey ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          <span>Save API Key</span>
                        </>
                      )}
                    </button>
                  )}

                  {geminiKeyStatus.hasKey && (
                    <button
                      onClick={handleDeleteGeminiKey}
                      disabled={deletingGeminiKey}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-red-600 hover:bg-red-700 text-white mt-4 disabled:bg-gray-400`}
                    >
                      {deletingGeminiKey ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5" />
                          <span>Delete API Key</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Reddit OAuth Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <svg className="h-6 w-6 text-orange-600 dark:text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reddit Authentication</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Connect your Reddit account to access higher rate limits and avoid API restrictions when fetching posts and comments.
            </p>

            <div className="space-y-4">
              <RedditAuthButton 
                authState={redditAuthState} 
                onAuthStateChange={handleAuthStateChange} 
              />
              
              {redditAuthState.isAuthenticated && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-green-700 dark:text-green-300 font-medium">
                        Reddit account connected successfully
                      </p>
                      <p className="text-green-600 dark:text-green-400 text-sm">
                        You now have access to higher rate limits for Reddit API requests
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;